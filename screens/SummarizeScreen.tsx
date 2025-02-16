/**
 * Screen for displaying and generating note summaries.
 * Provides summarization functionality for transcribed notes.
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Alert, Share } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { updateNoteContent } from '../store/noteSlice';
import { getLlamaContext } from '../services/llama';
import { Button } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import { generateEmbedding } from '../services/vector';
import { storeEmbedding, deleteNoteEmbeddings } from '../services/database';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Share2 } from 'lucide-react-native';

type SummarizeScreenProps = {};

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

const processAndStoreEmbeddings = async (text: string, noteId: string) => {
  console.log('Starting processAndStoreEmbeddings', {
    hasText: !!text,
    textLength: text.length,
    noteId: noteId
  });

  if (!text || !noteId) {
    console.warn('Missing required data for embeddings:', {
      hasText: !!text,
      hasNoteId: !!noteId
    });
    return;
  }

  try {
    // Delete existing embeddings first
    await deleteNoteEmbeddings(noteId);
    
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
          
          await storeEmbedding(noteId, chunk, embedding);
          console.log(`Successfully stored embedding for chunk ${i + 1}`);
        } else {
          console.warn(`No embedding generated for chunk ${i + 1}`);
        }
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
      }
    }

    console.log('Completed processing all chunks');
  } catch (error) {
    console.error('Error in processAndStoreEmbeddings:', error);
    throw error;
  }
};

const SummarizeScreen: React.FC<SummarizeScreenProps> = () => {
  const [summarizedText, setSummarizedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const activeNoteId = useSelector((state: RootState) => state.ui.activeNoteId);
  const noteId = useRef(activeNoteId || '');
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const scrollViewRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    console.log('[SummarizeScreen] Screen focused or ID changed:', {
      isFocused,
      activeNoteId,
      currentNoteId: noteId.current,
      noteContent: note?.content
    });

    if (isFocused && activeNoteId) {
      // Always update noteId.current when activeNoteId changes
      noteId.current = activeNoteId;
      
      // Clear summarized text when switching to a new note
      if (activeNoteId !== noteId.current) {
        setSummarizedText('');
      }
    }
  }, [activeNoteId, isFocused]);

  // Get note content from Redux store with proper dependency tracking
  const note = useSelector((state: RootState) => 
    state.notes.notes.find(n => n.id === activeNoteId)
  );

  const transcribedText = note?.content || '';

  // Update button disabled state based on transcribedText
  const isDisabled = isLoading || !activeNoteId;

  // Add effect to load summary when note changes
  useEffect(() => {
    if (note?.summary) {
      setSummarizedText(note.summary);
    } else {
      setSummarizedText('');
    }
  }, [note?.summary]);

  // Add useEffect to handle auto-scrolling when summarizedText changes
  useEffect(() => {
    if (summarizedText && scrollViewRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [summarizedText]);

  const generateSummary = async () => {
    if (!note?.content) {
      console.error('No content available for summarization', {
        noteId: noteId.current,
        hasNote: !!note,
        hasContent: !!note?.content
      });
      setSummarizedText('No content available for summarization. Please ensure the note has content.');
      return;
    }

    setIsLoading(true);
    const llamaContext = getLlamaContext();

    if (!llamaContext || !llamaContext.llama) {
      Alert.alert('Model Not Ready', 'Please wait a moment for the AI model to initialize and try again.');
      return;
    }

    try {
      const systemPrompt = `<|im_start|>system\n
      You are an advanced AI designed to summarize transcripts with precision and clarity. 
      Your tasks are:
      1. Create a concise but detailed summary that captures all critical information
      <|im_end|>`;

      const userPrompt = `<|im_start|>user\n
      Please summarize this transcript. Add action items if any are found.
      Transcript to summarize:
      ${transcribedText}
      <|im_end|><|im_start|>assistant\n`;

      const fullPrompt = systemPrompt + userPrompt;

      let summary = '';
      const result = await llamaContext.llama?.completion(
        {
          prompt: fullPrompt,
          n_predict: 1024,
          temperature: 0.7,
        },
        (data) => {
          if (data.token === "<|im_end|>") {
            return;
          }
          summary += data.token;
          setSummarizedText(summary);
        }
      );

      if (!result) {
        throw new Error('Summarization failed');
      }

      const finalSummary = result.text.replace("<|im_end|>", "");
      setSummarizedText(finalSummary);

      // Generate title
      const titlePrompt = `<|im_start|>system\n
      Give a short title (10 words or less) for the below Summary. Return only the title. 
      Do not use markdown, return it in plaintext
      <|im_end|><|im_start|>user\n
      Summary:
      ${finalSummary}
      <|im_end|><|im_start|>assistant\n`;

      const titleResult = await llamaContext.llama?.completion({
        prompt: titlePrompt,
        n_predict: 20,
        temperature: 0.7,
      });

      if (titleResult) {
        const cleanTitle = titleResult.text
          .replace("<|im_end|>", "")
          .replace(/[#*_~`]/g, '') // Remove markdown characters
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove markdown links but keep text
          .replace(/^\s*[-+*]\s+/, '') // Remove list markers
          .trim()
          .replace(/["']/g, '');

        navigation.setOptions({
            title: cleanTitle
        });
        
        // Update note with new title and summary
        await dispatch(updateNoteContent({
          id: noteId.current,
          content: transcribedText,
          summary: finalSummary,
          title: cleanTitle
        }));
      }
      
      // Process and store embeddings with noteId
      await processAndStoreEmbeddings(transcribedText, noteId.current);

    } catch (error) {
      console.error('Error in summarization process:', error);
      setSummarizedText('Sorry, I encountered an error while summarizing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add share handler function
  const handleShare = async () => {
    if (!summarizedText) {
      Alert.alert('No Summary', 'Please generate a summary first before sharing.');
      return;
    }

    try {
      const result = await Share.share({
        message: `${note?.title || 'Note Summary'}\n\n${summarizedText}`,
      });
    } catch (error) {
      console.error('Error sharing summary:', error);
      Alert.alert('Error', 'Failed to share the summary. Please try again.');
    }
  };

  const markdownStyles = {
    body: {
      color: '#fff',
    },
    heading1: {
      color: '#fff',
      fontSize: 24,
      marginBottom: 16,
    },
    heading2: {
      color: '#fff',
      fontSize: 20,
      marginBottom: 12,
    },
    paragraph: {
      color: '#fff',
      fontSize: 16,
      lineHeight: 24,
    },
    listItem: {
      color: '#fff',
    },
    bullet_list: {
      color: '#fff',
    },
  };

  return (
    <View style={styles.container}>
      {/* Header with buttons */}
      <View style={styles.header}>
        <Button
          mode="contained"
          onPress={generateSummary}
          disabled={isDisabled}
          style={[styles.summarizeButton, isDisabled && styles.buttonDisabled]}
          labelStyle={styles.buttonLabel}
          textColor="#fff"
        >
          {isLoading ? 'Generating...' : (summarizedText ? 'Regenerate Summary' : 'Generate Summary')}
        </Button>
        
        {/* Replace Share button */}
        {summarizedText && (
          <TouchableOpacity 
            onPress={handleShare}
            style={styles.shareButton}
          >
            <Share2 
              size={24}
              color="#fff"
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Title */}
      {transcribedText && (
        <Text style={[styles.titleText, styles.titlePadding]}>{note?.title || 'Note Summary'}</Text>
      )}

      {/* Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {!transcribedText ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              No content available for summarization. Please add some notes first.
            </Text>
          </View>
        ) : summarizedText ? (
          <View style={styles.summaryContainer}>
            <Markdown style={markdownStyles}>
              {summarizedText}
            </Markdown>
          </View>
        ) : (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              Generate a summary to see it here
            </Text>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    gap: 8, // Add gap between buttons
  },
  summarizeButton: {
    height: 44,
    borderRadius: 24,
    flex: 1, // Changed from width: '100%' to flex: 1
    backgroundColor: '#2a6773',
  },
  shareButton: {
    height: 44,
    width: 48,
    borderRadius: 24,
    backgroundColor: '#2a6773',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#2c2c2c',
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryContainer: {
    padding: 16,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  messageText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  titlePadding: {
    padding: 16,
  },
});

export default SummarizeScreen; 