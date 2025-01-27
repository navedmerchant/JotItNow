/**
 * Screen for recording and transcribing audio notes.
 * Uses whisper.rn for transcription and llama.rn for summarization.
 */

import 'react-native-get-random-values';
import {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  ExpoSpeechRecognitionModule,
  setCategoryIOS,
} from "expo-speech-recognition";
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { addNoteWithPersistence, updateNoteContent } from '../store/noteSlice';
import { AppDispatch, RootState } from '../store/store';
import { v4 as uuidv4 } from 'uuid';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { TabParamList } from '../App';
import { setActiveNoteId } from '../store/uiSlice';

// Add type for the stop function
type StopFunction = () => Promise<void>;

type RecordScreenProps = {};

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

const RecordScreen: React.FC<RecordScreenProps> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notes = useSelector((state: RootState) => state.notes.notes);
  const activeNoteId = useSelector((state: RootState) => state.ui.activeNoteId);
  // State for recording and text management
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  // Add state for preview text
  const [previewText, setPreviewText] = useState('');

  useKeepAwake();

  setCategoryIOS({
    category: AVAudioSessionCategory.record, // or "playAndRecord"
    categoryOptions: [
      AVAudioSessionCategoryOptions.allowBluetooth,
    ],
    mode: AVAudioSessionMode.default,
  });

  const startListener = ExpoSpeechRecognitionModule.addListener("start", () => {setIsRecording(true);});
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
        if (!noteId.current) {
          noteId.current = uuidv4();
          console.log('[RecordScreen] Creating new note:', {
            noteId: noteId.current
          });

          await dispatch(addNoteWithPersistence({
            id: noteId.current,
            title: 'New Recording',
            content: transcribedText,
            date: new Date(),
          }));
          
          // Update active note ID in Redux instead of navigation params
          dispatch(setActiveNoteId(noteId.current));
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

  // Add useEffect to load note data
  useEffect(() => {
    console.log('useEffect[activeNoteId] - Loading note data', {
      activeNoteId,
      foundNote: notes.find(n => n.id === activeNoteId)?.id
    });
    
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (note) {
        setTranscribedText(note.content);
      }
      noteId.current = activeNoteId;
    }
  }, [activeNoteId]);

  // Add useEffect to update note content when transcribedText changes
  useEffect(() => {
    const updateNote = async () => {
      if (noteId.current && transcribedText) {
        console.log('Updating note content:', {
          noteId: noteId.current,
          contentLength: transcribedText.length
        });
        
        await dispatch(updateNoteContent({
          id: noteId.current,
          content: transcribedText
        }));
      }
    };

    updateNote();
  }, [transcribedText, dispatch]);

  // Inside RecordScreen component, add noteId ref
  const noteId = useRef<string>('');

  return (
    <View style={styles.container}>
      {/* Header with buttons */}
      <View style={styles.header}>
        <View style={styles.flex} />
      </View>

      {/* Rest of the content */}
      <ScrollView style={styles.textContainer}>
        <Text style={styles.text}>
          {transcribedText}
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
  recordButton: {
    marginBottom: 16,
  },
  previewText: {
    color: '#999999',
    fontStyle: 'italic',
  },
});

export default RecordScreen; 