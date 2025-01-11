/**
 * Redux slice for managing notes state.
 * Handles CRUD operations for notes with SQLite persistence.
 */

import { createSlice, PayloadAction, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { getDatabase } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface Note {
  id?: string;
  title: string;
  content: string;
  date: string;
  summary?: string;
}

interface NoteState {
  notes: Note[];
  loading: boolean;
  error: string | null;
}

const initialState: NoteState = {
  notes: [],
  loading: false,
  error: null,
};

// Async thunk for fetching notes from database
export const fetchNotes = createAsyncThunk(
  'notes/fetchNotes',
  async () => {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }
    console.log('Fetching notes');
    try {
      const [results] = await db.executeSql('SELECT * FROM notes ORDER BY date DESC');
      const notes: Note[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        console.log(results.rows.item(i));
        const row = results.rows.item(i);
        notes.push({
          ...row,
          date: row.date,
        });
      }
      return notes;
    } catch (error) {
      throw new Error(`Failed to fetch notes: ${error}`);
    }
  }
);

// Async thunk for adding a new note with persistence
export const addNoteWithPersistence = createAsyncThunk(
  'notes/addNoteWithPersistence',
  async (note: Omit<Note, 'date'> & { date: Date }) => {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }

    const noteToSave = {
      ...note,
      id: note.id || uuidv4(),
      date: note.date.toISOString()
    };
    
    try {
      await db.executeSql(
        'INSERT INTO notes (id, title, content, date, summary) VALUES (?, ?, ?, ?, ?)',
        [noteToSave.id, noteToSave.title, noteToSave.content, noteToSave.date, noteToSave.summary]
      );
      return noteToSave;
    } catch (error) {
      throw new Error(`Failed to save note: ${error}`);
    }
  }
);

// Redux slice configuration
export const noteSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Handle loading states and responses for async operations
      .addCase(fetchNotes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotes.fulfilled, (state, action) => {
        state.notes = action.payload;
        state.loading = false;
      })
      .addCase(fetchNotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notes';
      })
      .addCase(addNoteWithPersistence.fulfilled, (state, action) => {
        state.notes.unshift(action.payload);
      });
  },
});

export default noteSlice.reducer; 