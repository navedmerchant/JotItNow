/**
 * Screen for displaying and generating note summaries.
 * Provides summarization functionality for transcribed notes.
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { updateNoteContent } from '../store/noteSlice';
import { getLlamaContext } from '../services/llama';
import { Button } from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import { generateEmbedding } from '../services/vector';
import { storeEmbedding, deleteNoteEmbeddings } from '../services/database';
import { useIsFocused, useNavigation } from '@react-navigation/native';

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
  
  useEffect(() => {
    console.log('[SummarizeScreen] Screen focused or ID changed:', {
      isFocused,
      activeNoteId,
      currentNoteId: noteId.current
    });

    if (isFocused && activeNoteId && activeNoteId !== noteId.current) {
      console.log('[SummarizeScreen] Updating noteId:', {
        old: noteId.current,
        new: activeNoteId
      });
      noteId.current = activeNoteId;
    }
  }, [activeNoteId, isFocused]);

  // Get note content from Redux store
  const note = useSelector((state: RootState) => 
    state.notes.notes.find(n => n.id === noteId.current)
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: note?.title || 'New Note'
    });
  }, [activeNoteId, navigation]);

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

  const generateSummary = async () => {
    if (!transcribedText) {
      console.error('No text to summarize');
      return;
    }

    setIsLoading(true);
    const llamaContext = getLlamaContext();

    try {
      const systemPrompt = `<|im_start|>system\n
      You are an advanced AI designed to summarize meeting or lecture transcripts with precision and clarity. 
      Your tasks are:
      1. Create a concise but detailed summary that captures all critical information
      2. Extract and list any action items, including who is responsible and deadlines if mentioned
      3. Maintain the original intent while being clear and concise
      4. Format the output in markdown with clear sections using # for main headings and ## for subheadings
      5. Use bullet points (•) for lists and emphasis (*) for important points
      <|im_end|>`;

      const userPrompt = `<|im_start|>user\n
      Please summarize this transcript and format it in markdown with the Summary, Keypoints 
      and action items if any.
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
      Give a short title for the below Summary. Return only the title. 
      Do not use markdown, return it in plaintext
      <|im_end|><|im_start|>user\n
      Summary:
      ${finalSummary}
      <|im_end|><|im_start|>assistant\n`;

      const titleResult = await llamaContext.llama?.completion({
        prompt: titlePrompt,
        n_predict: 50,
        temperature: 0.7,
      });

      if (titleResult) {
        const cleanTitle = titleResult.text
          .replace("<|im_end|>", "")
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
      {/* Header with button */}
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
      </View>

      {/* Content */}
      <ScrollView style={styles.contentContainer}>
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
  },
  summarizeButton: {
    height: 48,
    borderRadius: 24,
    width: '100%',
    backgroundColor: '#007AFF',
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
});

export default SummarizeScreen; 