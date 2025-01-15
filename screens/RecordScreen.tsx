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
import VoiceService from '../services/voice';
import { v4 as uuidv4 } from 'uuid';
import { storeEmbedding } from '../services/database';
import { generateEmbedding, loadVectorContext } from '../services/vector';

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
      setTranscribedText(transcribedText + event.results[0]?.transcript);
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

  // Generate summary using LLM
  const summarizeText = async () => {
    // TODO: Implement llama.rn summarization
    console.log('Summarizing text:', transcribedText);
    setSummarizedText(transcribedText);
    setShowSummarized(true);
    await loadVectorContext();
    processAndStoreEmbeddings(transcribedText).catch(console.error);
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

  // Add useEffect for cleanup
  useEffect(() => {
    console.log('useEffect[] - Setting up voice service cleanup');
    const voiceService = VoiceService.getInstance();
    
    return () => {
      console.log('Cleanup function called - destroying voice service');
      voiceService.destroy().catch(console.error);
    };
  }, []);

  // Add useEffect for setting up the callback
  useEffect(() => {
    console.log('useEffect[] - Setting up transcription callback');
    const voiceService = VoiceService.getInstance();
    
    voiceService.setOnTranscriptionCallback((results) => {
      console.log('Transcription callback received results:', {
        resultsLength: results.length,
        firstResult: results[0]?.slice(0, 50) // Log first 50 chars
      });
      
      if (results.length > 0) {
        setTranscribedText(results[0]);
      }
    });
  }, []);

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
            style={styles.summarizeButton}
          >
            Summarize
          </Button>
        )}
        <View style={styles.flex} />
        <Button
          mode="text"
          onPress={() => setShowSummarized(!showSummarized)}
          disabled={!summarizedText}
        >
          {showSummarized ? 'Summary' : 'Transcript'}
        </Button>
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
          style={styles.recordButton}
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
  },
  header: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  flex: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
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
    color: '#666666',
    fontStyle: 'italic',
  },
});

export default RecordScreen; 