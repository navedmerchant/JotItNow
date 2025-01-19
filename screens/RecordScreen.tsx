/**
 * Screen for recording and transcribing audio notes.
 * Uses whisper.rn for transcription and llama.rn for summarization.
 */

import 'react-native-get-random-values';
import {
  ExpoSpeechRecognitionModule,
} from "expo-speech-recognition";
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { addNoteWithPersistence, updateNoteContent } from '../store/noteSlice';
import { AppDispatch, RootState } from '../store/store';
import { v4 as uuidv4 } from 'uuid';
import { storeEmbedding } from '../services/database';
import { generateEmbedding, loadVectorContext } from '../services/vector';
import { getLlamaContext } from '../services/llama';

// Add type for the stop function
type StopFunction = () => Promise<void>;

type RecordScreenProps = {
  route?: { params?: { noteId?: string } };
};

// Add helper function at the top of the file, before the RecordScreen component
const splitIntoChunks = (text: string, targetLength: number = 300): string[] => {
  // Split into sentences (accounting for multiple punctuation types)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    // Count words in current chunk plus new sentence
    const potentialChunk = currentChunk + sentence;
    const wordCount = potentialChunk.trim().split(/\s+/).length;

    if (wordCount > targetLength && currentChunk) {
      // If adding sentence exceeds limit and we have content, start new chunk
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      // Add sentence to current chunk
      currentChunk += sentence;
    }
  }

  // Add remaining text if any
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

const RecordScreen: React.FC<RecordScreenProps> = ({ route }) => {
  const dispatch = useDispatch<AppDispatch>();
  const notes = useSelector((state: RootState) => state.notes.notes);
  // State for recording and text management
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [summarizedText, setSummarizedText] = useState('');
  const [showSummarized, setShowSummarized] = useState(false);
  // Add state for storing the stop function
  const stopFunctionRef = useRef<StopFunction | null>(null);
  // Inside RecordScreen component, add noteId ref
  const noteId = useRef<string>('');
  // Add new state for preview text
  const [previewText, setPreviewText] = useState('');

  const startListener = ExpoSpeechRecognitionModule.addListener("start", () => {setIsRecording(true); setShowSummarized(false);});
  const endListener = ExpoSpeechRecognitionModule.addListener("end", () => {setIsRecording(false);});
  const resultListener = ExpoSpeechRecognitionModule.addListener("result", (event) => {
    if (event.isFinal) {
      setTranscribedText(transcribedText + (event.results[0]?.transcript || ''));
      setPreviewText(''); // Clear preview when result is final
    } else {
      // Show interim results in preview
      setPreviewText(event.results[0]?.transcript || '');
    }
  });
  const errorListener = ExpoSpeechRecognitionModule.addListener("error", (event) => {
    console.log("error code:", event.error, "error message:", event.message);
  });

  useEffect(() => {
    return () => {
      startListener.remove();
      endListener.remove();
      resultListener.remove();
      errorListener.remove();
    };
  }, []);

  // Toggle recording state and handle transcription
  const toggleRecording = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      console.warn("Permissions not granted", result);
      return;
    }

    try {
      if (!isRecording) {
        // Generate new note ID when starting recording
        if (!noteId.current) {
          console.log('Generating new note ID');
          noteId.current = uuidv4();
          dispatch(addNoteWithPersistence({
            id: noteId.current,
            title: 'New Recording',
            content: transcribedText,
            date: new Date(),
            summary: summarizedText
          }));
        }
        ExpoSpeechRecognitionModule.start({
          lang: "en-US",
          interimResults: true,
          maxAlternatives: 1,
          continuous: true,
          requiresOnDeviceRecognition: true,
          addsPunctuation: true,
        });
        
      } else {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      setIsRecording(false);
    }
  };

  // Update the summarizeText function
  const summarizeText = async () => {
    console.log('Summarizing text:', transcribedText);
    setShowSummarized(true);
    const llamaContext = getLlamaContext();
    if (!llamaContext || !llamaContext.llama) {
      console.error('Llama context not found');
      return;
    }

    const systemPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
    You are an advanced AI designed to summarize transcripts with precision and clarity. Your tasks are:
    1. Create a concise but detailed summary that captures all critical information
    2. Extract and list any action items, including who is responsible and deadlines if mentioned
    3. Maintain the original intent while being clear and concise
    4. Format the output in markdown with clear sections
    <|eot_id|>`;

    const userPrompt = `<|start_header_id|>user<|end_header_id|>
    Please summarize this transcript:
    ${transcribedText}
    <|eot_id|><|start_header_id|>assistant<|end_header_id|>`;

    const fullPrompt = systemPrompt + userPrompt;

    try {
      let summary = '';
      const result = await llamaContext.llama.completion(
        {
          prompt: fullPrompt,
          n_predict: 1024,
          temperature: 0.7,
        },
        (data) => {
          if (data.token === "<|eot_id|>") {
            return;
          }
          summary += data.token;
          setSummarizedText(summary);
        }
      );

      if (!result) {
        throw new Error('Summarization failed');
      }

      const finalSummary = result.text.replace("<|eot_id|>", "");
      setSummarizedText(finalSummary);
      await processAndStoreEmbeddings(transcribedText);

    } catch (error) {
      console.error('Error generating summary:', error);
      setSummarizedText('Sorry, I encountered an error while summarizing. Please try again.');
    }
  };

  // Add useEffect to save note whenever transcribed text changes
  useEffect(() => {
    console.log('useEffect[transcribedText, summarizedText] - Saving note', {
      hasText: !!transcribedText,
      noteId: noteId.current,
      summarizedLength: summarizedText.length
    });
    
    if (transcribedText && noteId.current) {
      dispatch(updateNoteContent({
        id: noteId.current,
        content: transcribedText,
        summary: summarizedText
      }));
    }
  }, [transcribedText, summarizedText]);

  // Add useEffect to load note data
  useEffect(() => {
    const paramNoteId = route?.params?.noteId;
    console.log('useEffect[route?.params?.noteId] - Loading note data', {
      paramNoteId,
      foundNote: notes.find(n => n.id === paramNoteId)?.id
    });
    
    if (paramNoteId) {
      const note = notes.find(n => n.id === paramNoteId);
      if (note) {
        setTranscribedText(note.content);
        setSummarizedText(note.summary || '');
      }
      noteId.current = paramNoteId;
    }
  }, [route?.params?.noteId]);

  const processAndStoreEmbeddings = async (text: string) => {
    console.log('Starting processAndStoreEmbeddings', {
      hasText: !!text,
      textLength: text.length,
      noteId: noteId.current
    });

    if (!text || !noteId.current) {
      console.warn('Missing required data for embeddings:', {
        hasText: !!text,
        hasNoteId: !!noteId.current
      });
      return;
    }
    
    // Split text into chunks
    const chunks = splitIntoChunks(text);
    console.log('Split text into chunks:', {
      numberOfChunks: chunks.length,
      averageChunkLength: chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length
    });
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}`, {
        chunkLength: chunk.length,
        chunkPreview: chunk.substring(0, 50) + '...'
      });

      try {
        const embedding = await generateEmbedding(chunk);
        if (embedding) {
          console.log(`Generated embedding for chunk ${i + 1}`, {
            embeddingLength: embedding.length,
            firstFewValues: embedding.slice(0, 3)
          });
          
          await storeEmbedding(noteId.current, chunk, embedding);
          console.log(`Successfully stored embedding for chunk ${i + 1}`);
        } else {
          console.warn(`No embedding generated for chunk ${i + 1}`);
        }
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
      }
    }

    console.log('Completed processing all chunks');
  };

  return (
    <View style={styles.container}>
      {/* Header with buttons */}
      <View style={styles.header}>
        {!isRecording && transcribedText && !showSummarized && (
          <Button
            mode="contained"
            onPress={summarizeText}
            style={[styles.summarizeButton, { backgroundColor: '#007AFF' }]}
            textColor="#fff"
          >
            Summarize
          </Button>
        )}
        <View style={styles.flex} />
        {transcribedText && (  // Only show toggle when there's text
          <Button
            mode="contained"  // Changed from mode="text"
            onPress={() => setShowSummarized(!showSummarized)}
            disabled={!summarizedText}
            style={{ backgroundColor: '#007AFF' }}  // Added style
            textColor="#fff"
          >
            {showSummarized ? 'Show Transcript' : 'Show Summary'}
          </Button>
        )}
      </View>

      {/* Rest of the content */}
      <ScrollView style={styles.textContainer}>
        <Text style={styles.text}>
          {showSummarized ? summarizedText : transcribedText}
        </Text>
        {isRecording && previewText && (
          <Text style={[styles.text, styles.previewText]}>
            {previewText}
          </Text>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomContainer}>
        <Button
          mode="contained"
          onPress={toggleRecording}
          style={[styles.recordButton, { 
            backgroundColor: isRecording ? '#c20a10' : '#007AFF'
          }]}
          textColor="#fff"
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1c1c1c',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#1c1c1c',
  },
  flex: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
    backgroundColor: '#2c2c2c',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#fff',
  },
  bottomContainer: {
    marginTop: 'auto',
  },
  summarizeButton: {
    marginRight: 8,
  },
  recordButton: {
    marginBottom: 16,
  },
  previewText: {
    color: '#999999',
    fontStyle: 'italic',
  },
});

export default RecordScreen; 