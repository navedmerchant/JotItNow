/**
 * Chat screen component that provides a messaging interface.
 * Allows users to chat with context from the notes using llama.rn.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import ChatMessage from '../components/ChatMessage';
import { useDispatch, useSelector } from 'react-redux';
import { fetchChatMessages, addChatMessage } from '../store/chatSlice';
import { AppDispatch, RootState } from '../store/store';
import { loadLlamaContext } from '../services/llama';
import { generateEmbedding, loadVectorContext, unloadVectorContext } from '../services/vector';
import { findSimilarChunks } from '../services/database';

type ChatScreenProps = {
  route?: { params?: { noteId?: string } };  // Optional route params for noteId
};

const ChatScreen: React.FC<ChatScreenProps> = ({ route }) => {
  // Generate new noteId if not provided through navigation
  const noteId = route?.params?.noteId || Date.now().toString();
  const dispatch = useDispatch<AppDispatch>();
  const chatContext = useRef('');

  const systemPrompt = useRef('');
  systemPrompt.current =  `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
      You are a note taking AI assistant. You are given the relevant context of the note.
      The context will be provided in <context> tags. Answer the user's question based on the context.
      If the user's question is not related to the context, say so.
      If the user's question is related to the context, answer the question.
      If the user's question is not clear, ask for clarification.
      If the user's question is a request for information, provide the information.
      If the user's question is a request for help, provide help.
      If the user's question is a request for a task to be completed, complete the task.
      <|eot_id|>`;
  
  // Get messages for this note from Redux store
  const messages = useSelector((state: RootState) => 
    state.chat.messages[noteId] || []
  );

  const [message, setMessage] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');

  // Handle sending new messages
  const sendMessage = async () => {
    if (!message.trim()) return;
    console.log('[Chat] Starting to send message:', message.trim());
    setMessage('');

    await loadVectorContext();
    const embedding = await generateEmbedding(message);
    const similarChunks = await findSimilarChunks(embedding);
    console.log('similarChunks', similarChunks);
    console.log('[Chat] Found similar chunks:', similarChunks.length);
    
    await unloadVectorContext();

    const userMessage = {
      noteId,
      message: message.trim(),
      isUser: true,
      timestamp: new Date().toISOString(),
    };
    console.log('[Chat] Dispatching user message:', userMessage);
    await dispatch(addChatMessage(userMessage));

    const llamaContext = await loadLlamaContext();
    if (!llamaContext || !llamaContext.llama) {
      console.error('[Chat] Failed to load llama context');
      return;
    } 

    const firstPrompt = `${systemPrompt.current}<|start_header_id|>user<|end_header_id|> 
    ${message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

    const otherPrompts = `<|start_header_id|>user<|end_header_id|> 
    ${message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

    let prompt;
    if (messages.length == 0) {
      prompt = firstPrompt;
    } else {
      prompt = otherPrompts;
    }

    chatContext.current = chatContext.current + prompt;
    console.log('chatContext.current', chatContext.current);
    // Start streaming response
    try {
      console.log('[Chat] Starting llama completion');
      const { text, timings } = await llamaContext.llama.completion(
        {
          prompt: chatContext.current,
          n_predict: 1024,
          temperature: 0.7,
        },
        (data: any) => {
          if  (data.token == "<|eot_id|>") {
              return;
          }
          setCurrentResponse(prev => prev + data.token);
        },
      )

      chatContext.current = chatContext.current + text;

      const aiMessage = {
        noteId,
        message: currentResponse,
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      console.log('[Chat] Dispatching AI response:', aiMessage);
      await dispatch(addChatMessage(aiMessage));

      // Clear the current response and input
      setCurrentResponse('');
      
    } catch (error) {
      console.error('[Chat] Error in completion:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        renderItem={({ item }) => <ChatMessage message={item} />}
        keyExtractor={item => item.id}
        style={styles.messageList}
      />
      {currentResponse && (
        <View style={styles.currentResponseContainer}>
          <Text style={styles.currentResponseText}>
            {currentResponse}
          </Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={styles.input}
          mode="outlined"
          outlineColor="#e0e0e0"
          activeOutlineColor="#6200ee"
          dense
          multiline
          outlineStyle={{ borderRadius: 20 }}
         />
        <Button 
          mode="contained" 
          onPress={sendMessage}
          style={styles.sendButton}
          contentStyle={{ borderRadius: 20 }}
        >
          Send
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 60,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    borderRadius: 20,
  },
  sendButton: {
    borderRadius: 20,
  },
  currentResponseContainer: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  currentResponseText: {
    fontSize: 16,
    color: '#333',
  },
});

export default ChatScreen; 