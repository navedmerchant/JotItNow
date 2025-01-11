/**
 * Component for rendering individual chat messages.
 * Displays messages differently based on whether they're from the user or AI.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type ChatMessageProps = {
  message: {
    message: string;   // Message content
    isUser: boolean;   // Determines message styling
  };
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <View style={[
      styles.container,
      message.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <Text style={styles.text}>{message.message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9E9EB',
  },
  text: {
    fontSize: 16,
  },
});

export default ChatMessage; 