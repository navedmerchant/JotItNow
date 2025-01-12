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
    if (!db) throw new Error('Database not initialized');
    
    console.log(`[DB] Fetching chat messages for noteId: ${noteId}`);
    
    const results = await db.execute(
      'SELECT * FROM chats WHERE noteId = ? ORDER BY timestamp ASC',
      [noteId]
    );
    
    console.log(`[DB] Found ${results.rows.length} messages for noteId: ${noteId}`);
    
    // Convert database rows to ChatMessage objects
    const messages: ChatMessage[] = results.rows.map(row => ({
      ...row,
      isUser: Boolean(row.isUser),
      timestamp: new Date(row.timestamp),
    }));
    
    console.log('[DB] Processed messages:', messages);
    return { noteId, messages };
  }
);

export const addChatMessage = createAsyncThunk(
  'chat/addMessage',
  async (message: Omit<ChatMessage, 'id'>) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');
    
    const id = Date.now().toString();
    const newMessage = { ...message, id };
    
    console.log('[DB] Adding new chat message:', newMessage);
    
    await db.execute(
      'INSERT INTO chats (id, noteId, message, isUser, timestamp) VALUES (?, ?, ?, ?, ?)',
      [
        String(id),
        String(message.noteId),
        String(message.message),
        message.isUser ? 1 : 0,
        String(message.timestamp.toISOString())
      ]
    );
    
    console.log('[DB] Successfully added message with id:', id);
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