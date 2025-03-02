/**
 * Chat screen component that provides a messaging interface.
 * Allows users to chat with context from the notes using llama.rn.
 */

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Clipboard, EmitterSubscription, Keyboard, GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent, Text } from 'react-native';
import { getLlamaContext } from '../services/llama';
import { generateEmbedding } from '../services/vector';
import { findSimilarChunks, hasAnyChunks } from '../services/database';
import { Send } from 'lucide-react-native';
import { markdownStyles, menuOptionStyles, popoverStyles, styles } from './Styles';
import { Square } from 'lucide-react-native';
import { Menu, MenuOptions, MenuTrigger } from 'react-native-popup-menu';
import Markdown from 'react-native-markdown-display';
import { MenuOption } from 'react-native-popup-menu';
import Toast from 'react-native-simple-toast';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

type ChatScreenProps = {};

interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

const ChatScreen: React.FC<ChatScreenProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [hasContent, setHasContent] = useState(false);

  const chatContext = useRef('');
  const usedChunks = useRef(new Set<string>());
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const systemPrompt = useRef('');
  const isFocused = useIsFocused();
  const activeNoteId = useSelector((state: RootState) => state.ui.activeNoteId);
  const navigation = useNavigation();
  const notes = useSelector((state: RootState) => state.notes.notes);
  

  useEffect(() => {
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;

    if (Platform.OS === 'ios') {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', scrollToBottom);
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', scrollToBottom);
    }

    return () => {
      if (Platform.OS === 'ios') {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (isAutoScrolling) {
      scrollToBottom();
    }
  }, [contentHeight])

  useEffect(() => {
    const checkContent = async () => {
      console.log('[ChatScreen] Checking content for noteId:', {
        noteId: activeNoteId,
      });
      
      const hasChunks = await hasAnyChunks(activeNoteId || '');
      console.log('[ChatScreen] Has chunks result:', { hasChunks, noteId: activeNoteId });
      setHasContent(hasChunks);
    };

    if (isFocused) {
      checkContent();
    }
  }, [activeNoteId, isFocused]);

  useLayoutEffect(() => {
    const note = notes.find(note => note.id === activeNoteId);
    navigation.setOptions({
      title: note?.title || 'New Note'
    });
  }, [activeNoteId, notes]);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const addMessage = useCallback((text: string, isUser: boolean) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { id: Date.now(), text, isUser }
    ]);
    setTimeout(scrollToBottom, 100);
  }, []);


  const handleSend = useCallback(async () => {
    if (inputText.trim()) {
      addMessage(inputText, true);
      setInputText('');
      setIsTyping(true);

      systemPrompt.current =  `
      You are a note taking AI assistant. You are given the relevant context of the note.
      The context will be provided in <context> tags. Answer the user's question based on the context.
      If the user's question is not related to the context, say so.
      If the user's question is related to the context, answer the question.
      If the user's question is not clear, ask for clarification.
      If the user's question is a request for information, provide the information.
      If the user's question is a request for help, provide help.
      If the user's question is a request for a task to be completed, complete the task.
      `;

      const embedding = await generateEmbedding(inputText);
      console.log('[ChatScreen] Processing message with noteId:', {
        noteId: activeNoteId,
        hasEmbedding: !!embedding,
      });

      const similarChunks = await findSimilarChunks(embedding, activeNoteId || '');
      console.log('[ChatScreen] Found similar chunks:', {
        count: similarChunks.length,
        noteId: activeNoteId,
        firstChunk: similarChunks[0]?.chunk.substring(0, 50),
      });

      // Filter out chunks we've already used
      const newChunks = similarChunks.filter(chunk => !usedChunks.current.has(chunk.chunk));
      console.log('[ChatScreen] New chunks:', {
        count: newChunks.length,
        firstChunk: newChunks[0]?.chunk.substring(0, 50),
      });

      // Add new chunks to used set
      newChunks.forEach(chunk => usedChunks.current.add(chunk.chunk));

      // Build context from new chunks
      const contextText = newChunks
        .map(chunk => chunk.chunk)
        .join('\n\n');
  
      let contextPrompt;
      // Add context to prompt if we have similar chunks
      if (contextText) {
        contextPrompt = `<context>
        ${contextText}
        </context>`;
      } else {
        contextPrompt = '<context></context>';
      }

      const firstPrompt = `<|im_start|>system<\n
      ${systemPrompt.current}<|im_end|>\n<|im_start|>user\n
      ${contextPrompt}${inputText}<|im_end|>\n<|im_start|>assistant\n`

      const otherPrompts = `<|im_start|>user\n
      ${contextPrompt}${inputText}<|im_end|>\n<|im_start|>assistant\n`

      let prompt;
      if (messages.length == 0) {
        prompt = firstPrompt;
      } else {
        prompt = otherPrompts;
      }

      chatContext.current = chatContext.current + prompt;

      if (!getLlamaContext().llama) {
        console.log("context is undefined!")
        return;
      }

      try {
        // Do completion
        const result = await getLlamaContext().llama?.completion(
          {
            prompt: chatContext.current,
            n_predict: 1024,
            temperature: 0.7,
          },
          (data) => {
            if  (data.token == "<|im_end|>") {
                return;
            }
            setCurrentResponse(prev => prev + data.token);
          },
        )
        
        if (!result) {
          throw new Error('Completion failed');
        }
        
        const { text, timings } = result;
        chatContext.current = chatContext.current + text;
        const displayText = text.replace("<|im_end|>", "")
        addMessage(displayText, false);
      } catch (error) {
        console.error('Error generating AI response:', error);
        addMessage('Sorry, I encountered an error. Please try again.', false);
      } finally {
        setIsTyping(false);
        setCurrentResponse('');
      }
    }
  }, [inputText, addMessage, activeNoteId]);

  function handleStop(event: GestureResponderEvent): void {
    getLlamaContext().llama?.stopCompletion();
    setIsTyping(false);
  }

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize} : NativeScrollEvent) => {
    const paddingToBottom = 20;
    return layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  function handleScrollEvent(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const bottom = isCloseToBottom(event.nativeEvent);
    setIsAutoScrolling(bottom);
  }

  function handleContentSizeChange(w: number, h: number): void {
    setContentHeight(h);
  }

  const handleCopyText = (text: string) => {
    Clipboard.setString(text);
    Toast.show("Text copied to Clipboard", Toast.SHORT);
  };

  // ... (previous useEffect hooks and functions remain the same)

  const renderMessage = (message: Message) => (
    <Menu key={message.id}>
      <MenuTrigger
        triggerOnLongPress
        customStyles={{
          triggerTouchable: {
            underlayColor: 'transparent',
            activeOpacity: 0.6,
          },
        }}
      >
        <View
          style={[
            styles.messageBubble,
            message.isUser ? styles.userMessage : styles.aiMessage
          ]}
        >
          <Markdown style={markdownStyles}>{message.text}</Markdown>
        </View>
      </MenuTrigger>
      <MenuOptions customStyles={popoverStyles(message.isUser)}>
        <MenuOption onSelect={() => handleCopyText(message.text)} text="Copy" customStyles={menuOptionStyles}/>
      </MenuOptions>
    </Menu>
  );


  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 125 : 0} 
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScrollEvent}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16} 
      >
        {!hasContent ? (
          <View style={styles.noContentContainer}>
            <Text style={styles.noContentText}>
              No content available for chat. Please summarize your notes to process it for chat
            </Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.noMessagesContainer}>
            <Text style={styles.noMessagesText}>
              Chats are ephemeral and intended to ask questions about your notes. You can ask it any questions about your notes and the recording!
            </Text>
          </View>
        ) : (
          <>
            {messages.map(renderMessage)}
            {isTyping && (
              <View style={[styles.messageBubble, styles.aiMessage]}>
                <Text style={styles.aiMessageText}>{currentResponse}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, !hasContent && styles.inputDisabled]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={hasContent ? "Ask anything about the current note" : "Chat disabled - No content available"}
          placeholderTextColor="#999"
          ref={textInputRef}
          multiline={true}
          numberOfLines={2}
          editable={hasContent}
        />
        {isTyping ? (
          <TouchableOpacity 
            style={styles.stopButton} 
            onPress={handleStop}
            disabled={!hasContent}
          >
            <Square color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.sendButton, !hasContent && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!hasContent}
          >
            <Send color={hasContent ? "#fff" : "#999"} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen; 