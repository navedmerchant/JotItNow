/**
 * Screen for recording and transcribing audio notes.
 * Uses whisper.rn for transcription and llama.rn for summarization.
 */

import 'react-native-get-random-values';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { addNoteWithPersistence } from '../store/noteSlice';
import { AppDispatch, RootState } from '../store/store';
import VoiceService from '../services/voice';
import { v4 as uuidv4 } from 'uuid';

// Add type for the stop function
type StopFunction = () => Promise<void>;

type RecordScreenProps = {
  route?: { params?: { noteId?: string } };
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

  // Toggle recording state and handle transcription
  const toggleRecording = async () => {
    const voiceService = VoiceService.getInstance();
    
    try {
      if (!isRecording) {
        // Generate new note ID when starting recording
        noteId.current = uuidv4();
        
        setShowSummarized(false);
        // Start recording
        await voiceService.startListening();
        setIsRecording(true);
      } else {
        // Stop recording
        await voiceService.stopListening();
        setIsRecording(false);
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
  };

  // Add useEffect to save note whenever transcribed text changes
  useEffect(() => {
    if (transcribedText && noteId.current) {
      dispatch(addNoteWithPersistence({
        id: noteId.current,
        title: 'New Recording',
        content: transcribedText,
        date: new Date(),
        summary: summarizedText
      }));
    }
  }, [transcribedText, summarizedText, dispatch]);

  // Add useEffect for cleanup
  useEffect(() => {
    const voiceService = VoiceService.getInstance();
    
    return () => {
      console.log('Cleaning up voice service');
      voiceService.destroy().catch(console.error);
    };
  }, []);

  // Add useEffect for setting up the callback
  useEffect(() => {
    const voiceService = VoiceService.getInstance();
    
    voiceService.setOnTranscriptionCallback((results) => {
      if (results.length > 0) {
        setTranscribedText(results[0]); // Use the first (most confident) result
      }
    });
  }, []);

  // Add useEffect to load note data
  useEffect(() => {
    const noteId = route?.params?.noteId;
    if (noteId) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        setTranscribedText(note.content);
        setSummarizedText(note.summary || '');
      }
    }
  }, [route?.params?.noteId, notes]);

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
});

export default RecordScreen; 