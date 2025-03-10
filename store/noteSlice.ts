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
    console.log('[DB] Fetching all notes');
    try {
      const results = await db.execute('SELECT * FROM notes ORDER BY date DESC');
      console.log(`[DB] Found ${results.rows.length} notes`);
      console.log('[DB] Notes data:', results.rows);
      return results.rows as Note[];
    } catch (error) {
      console.error('[DB] Error fetching notes:', error);
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

    // Ensure date is a simple ISO string without any object wrapping
    const dateString = note.date instanceof Date 
      ? note.date.toISOString()
      : typeof note.date === 'string' 
        ? note.date 
        : new Date().toISOString();

    const noteToSave = {
      ...note,
      id: note.id || uuidv4(),
      date: dateString
    };
    
    console.log('[DB] Preparing note with date:', {
      rawDate: note.date,
      processedDate: dateString,
      dateType: typeof dateString
    });
    
    try {
      // Convert all values to primitive types
      const args = [
        String(noteToSave.id),
        String(noteToSave.title),
        String(noteToSave.content),
        String(dateString),
        noteToSave.summary ? String(noteToSave.summary) : ''
      ];

      console.log('[DB] Executing SQL with args:', args);

      await db.execute(
        'INSERT INTO notes (id, title, content, date, summary) VALUES (?, ?, ?, ?, ?)',
        [
          String(noteToSave.id),
          String(noteToSave.title),
          String(noteToSave.content),
          String(dateString),
          noteToSave.summary ? String(noteToSave.summary) : ''
        ]
      );
      
      console.log('[DB] Successfully saved note with id:', noteToSave.id);
      return noteToSave;
    } catch (error) {
      console.error('[DB] Error saving note:', {
        error,
        noteData: noteToSave,
        dateType: typeof dateString,
        dateValue: dateString
      });
      throw new Error(`Failed to save note: ${error}`);
    }
  }
);

// Async thunk for updating note content
export const updateNoteContent = createAsyncThunk(
  'notes/updateNoteContent',
  async (payload: { 
    id: string; 
    content: string; 
    summary?: string;
    title?: string;  // Add title as optional parameter
  }) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    await db.execute(
      `UPDATE notes 
       SET content = ?, 
           summary = COALESCE(?, summary),
           title = COALESCE(?, title)
       WHERE id = ?`,
      [payload.content, payload.summary, payload.title, payload.id]
    );

    return payload;
  }
);

// Add deleteNote thunk after other thunks
export const deleteNote = createAsyncThunk(
  'notes/deleteNote',
  async (noteId: string) => {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      // Delete embeddings first
      await db.execute('DELETE FROM embeddings WHERE noteId = ?', [noteId]);
      
      // Then delete the note
      await db.execute('DELETE FROM notes WHERE id = ?', [noteId]);
      
      return noteId;
    } catch (error) {
      console.error('[DB] Error deleting note and embeddings:', error);
      throw new Error(`Failed to delete note: ${error}`);
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
      })
      .addCase(updateNoteContent.fulfilled, (state, action) => {
        const index = state.notes.findIndex(note => note.id === action.payload.id);
        if (index !== -1) {
          state.notes[index].content = action.payload.content;
          if (action.payload.summary) {
            state.notes[index].summary = action.payload.summary;
          }
          if (action.payload.title) {
            state.notes[index].title = action.payload.title;
          }
        }
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        state.notes = state.notes.filter(note => note.id !== action.payload);
      });
  },
});

export default noteSlice.reducer; 