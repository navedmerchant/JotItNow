/**
 * Chat screen component that provides a messaging interface.
 * Allows users to chat with context from the notes using llama.rn.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import ChatMessage from '../components/ChatMessage';
import { useDispatch, useSelector } from 'react-redux';
import { fetchChatMessages, addChatMessage } from '../store/chatSlice';
import { AppDispatch, RootState } from '../store/store';

type ChatScreenProps = {
  route?: { params?: { noteId?: string } };  // Optional route params for noteId
};

const ChatScreen: React.FC<ChatScreenProps> = ({ route }) => {
  // Generate new noteId if not provided through navigation
  const noteId = route?.params?.noteId || Date.now().toString();
  const dispatch = useDispatch<AppDispatch>();
  
  // Get messages for this note from Redux store
  const messages = useSelector((state: RootState) => 
    state.chat.messages[noteId] || []
  );

  const [message, setMessage] = useState('');

  // Handle sending new messages
  const sendMessage = async () => {
    if (!message.trim()) return;

    await dispatch(addChatMessage({
      noteId,
      message: message.trim(),
      isUser: true,
      timestamp: new Date(),
    }));

    setMessage('');
    // TODO: Handle AI response with llama.rn
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => <ChatMessage message={item} />}
        keyExtractor={item => item.id}
        style={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Type your message..."
          style={styles.input}
        />
        <Button mode="contained" onPress={sendMessage}>
          Send
        </Button>
      </View>
    </View>
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
  },
  input: {
    flex: 1,
    marginRight: 8,
  },
});

export default ChatScreen; 