/**
 * Redux slice for managing chat messages.
 * Handles message persistence and state management for conversations.
 */

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { getDatabase } from '../services/database';

export interface ChatMessage {
  id: string;
  noteId: string;    // References the associated note
  message: string;    // Message content
  isUser: boolean;    // Whether message is from user or AI
  timestamp: Date;
}

interface ChatState {
  messages: Record<string, ChatMessage[]>;  // Messages grouped by noteId
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: {},
  loading: false,
  error: null,
};

// Async thunk to fetch messages for a specific note
export const fetchChatMessages = createAsyncThunk(
  'chat/fetchMessages',
  async (noteId: string) => {
    const db = getDatabase();
    const [results] = await db!.executeSql(
      'SELECT * FROM chats WHERE noteId = ? ORDER BY timestamp ASC',
      [noteId]
    );
    
    // Convert database rows to ChatMessage objects
    const messages: ChatMessage[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      messages.push({
        ...row,
        isUser: Boolean(row.isUser),
        timestamp: new Date(row.timestamp),
      });
    }
    
    return { noteId, messages };
  }
);

export const addChatMessage = createAsyncThunk(
  'chat/addMessage',
  async (message: Omit<ChatMessage, 'id'>) => {
    const db = getDatabase();
    const id = Date.now().toString();
    const newMessage = { ...message, id };
    
    await db!.executeSql(
      'INSERT INTO chats (id, noteId, message, isUser, timestamp) VALUES (?, ?, ?, ?, ?)',
      [
        id,
        message.noteId,
        message.message,
        message.isUser ? 1 : 0,
        message.timestamp.toISOString(),
      ]
    );
    
    return newMessage;
  }
);

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        const { noteId, messages } = action.payload;
        state.messages[noteId] = messages;
        state.loading = false;
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      .addCase(addChatMessage.fulfilled, (state, action) => {
        const { noteId } = action.payload;
        if (!state.messages[noteId]) {
          state.messages[noteId] = [];
        }
        state.messages[noteId].push(action.payload);
      });
  },
});

export default chatSlice.reducer; 