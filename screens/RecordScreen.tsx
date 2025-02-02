import 'react-native-get-random-values';
import {
  AVAudioSessionCategory,
  AVAudioSessionCategoryOptions,
  AVAudioSessionMode,
  ExpoSpeechRecognitionModule,
  setCategoryIOS,
} from "expo-speech-recognition";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { addNoteWithPersistence, updateNoteContent } from '../store/noteSlice';
import { AppDispatch, RootState } from '../store/store';
import { v4 as uuidv4 } from 'uuid';
import { useKeepAwake } from 'expo-keep-awake';
import { useNavigation } from '@react-navigation/native';
import { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { TabParamList } from '../App';
import { setActiveNoteId } from '../store/uiSlice';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { debounce } from 'lodash';

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

const SAVE_DELAY_MS = 1000; // 1 second delay

const RecordScreen: React.FC<RecordScreenProps> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notes = useSelector((state: RootState) => state.notes.notes);
  const activeNoteId = useSelector((state: RootState) => state.ui.activeNoteId);
  // State for recording and text management
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  // Add state for preview text
  const [previewText, setPreviewText] = useState('');
  const [showTranscription, setShowTranscription] = useState(false);
  const [manualNotes, setManualNotes] = useState('');

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

  // Update the useEffect for note content changes
  useEffect(() => {
    const updateNote = async () => {
      if (noteId.current) {
        console.log('Updating note content:', {
          noteId: noteId.current,
          manualNotesLength: manualNotes.length,
          transcribedTextLength: transcribedText.length
        });
        
        // Combine manual notes and transcribed text
        const combinedContent = `${manualNotes}\n\n--- Voice Transcription ---\n${transcribedText}`;
        
        await dispatch(updateNoteContent({
          id: noteId.current,
          content: combinedContent
        }));
      }
    };

    updateNote();
  }, [transcribedText, dispatch]);

  // Update the useEffect for loading note data
  useEffect(() => {
    console.log('useEffect[activeNoteId] - Loading note data', {
      activeNoteId,
      foundNote: notes.find(n => n.id === activeNoteId)?.id
    });
    
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (note) {
        // Split content into manual notes and transcription
        const parts = note.content.split('--- Voice Transcription ---');
        setManualNotes(parts[0]?.trim() || '');
        setTranscribedText(parts[1]?.trim() || '');
      }
      noteId.current = activeNoteId;
    }
  }, [activeNoteId]);

  // Inside RecordScreen component, add noteId ref
  const noteId = useRef<string>('');

  // Add debounced save function using useCallback
  const debouncedSave = useCallback(
    debounce(async (noteId: string, text: string, transcribedText: string) => {
      console.log('Saving note with debounce:', { noteId });
      const combinedContent = `${text}\n\n--- Voice Transcription ---\n${transcribedText}`;
      await dispatch(updateNoteContent({
        id: noteId,
        content: combinedContent
      }));
    }, SAVE_DELAY_MS),
    [dispatch, transcribedText]
  );

  // Update the handler to use debounced save
  const handleNotesChange = async (text: string) => {
    setManualNotes(text);
    
    if (noteId.current) {
      // Use debounced save for existing notes
      debouncedSave(noteId.current, text, transcribedText);
    } else {
      // Create new note immediately (no debounce for initial creation)
      noteId.current = uuidv4();
      await dispatch(addNoteWithPersistence({
        id: noteId.current,
        title: 'New Note',
        content: text,
        date: new Date(),
      }));
      dispatch(setActiveNoteId(noteId.current));
    }
  };

  // Add cleanup for debounced function
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const dynamicStyles = StyleSheet.create({
    notesInput: {
      flex: showTranscription ? 1 : 2,
      backgroundColor: '#2c2c2c',
      color: '#fff',
      padding: 16,
      borderRadius: 8,
      fontSize: 16,
      marginBottom: 16,
      textAlignVertical: 'top',
    },
    transcriptionContainer: {
      flex: showTranscription ? 1 : 0,
      backgroundColor: '#2c2c2c',
      borderRadius: 8,
      marginBottom: 16,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header with recording button */}
      <View style={styles.header}>
        <Button
          mode="contained"
          onPress={toggleRecording}
          style={[styles.recordButton, { 
            backgroundColor: isRecording ? '#c20a10' : '#007AFF'
          }]}
          labelStyle={styles.recordButtonLabel}
          textColor="#fff"
        >
          {isRecording ? 'Stop' : 'Record'}
        </Button>
      </View>

      {/* Manual Notes Input */}
      <TextInput
        style={dynamicStyles.notesInput}
        value={manualNotes}
        onChangeText={handleNotesChange}
        placeholder="Start typing your notes here..."
        placeholderTextColor="#666"
        multiline
        textAlignVertical="top"
      />

      {/* Transcription Section */}
      <View style={dynamicStyles.transcriptionContainer}>
        <TouchableOpacity 
          style={styles.transcriptionHeader}
          onPress={() => setShowTranscription(!showTranscription)}
        >
          <Text style={styles.transcriptionTitle}>Voice Transcription</Text>
          <IconButton
            icon={() => showTranscription ? 
              <ChevronUp color="#fff" size={24} /> : 
              <ChevronDown color="#fff" size={24} />
            }
          />
        </TouchableOpacity>

        {showTranscription && (
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
        )}
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
    alignItems: 'center', // Center items vertically
  },
  recordButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  recordButtonLabel: {
    fontSize: 14,
    marginVertical: 7,
    marginHorizontal: 0,
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
  previewText: {
    color: '#999999',
    fontStyle: 'italic',
  },
  transcriptionContainer: {
    backgroundColor: '#2c2c2c',
    borderRadius: 8,
    marginBottom: 16,
  },
  transcriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  transcriptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RecordScreen; 