/**
 * Database service using op-sqlite operations with sqlite-vec extension for vector operations.
 */

import { open } from '@op-engineering/op-sqlite';

// Database configuration
const DATABASE_NAME = 'NotesApp.db';
const EMBEDDING_DIMENSIONS = 384; // BGE small model dimension

interface Database {
  db: {
    execute(sql: string, args?: any[]): Promise<{ rows: any[] }>;
  } | null;
}

// Singleton database instance
const database: Database = {
  db: null,
};

type InitCallback = () => void;
let initCallbacks: InitCallback[] = [];

export const onDatabaseInitialized = (callback: InitCallback) => {
  initCallbacks.push(callback);
};

/**
 * Initializes the SQLite database and creates necessary tables.
 */
export const initDatabase = async () => {
  console.log('Initializing database...');
  try {
    const db = await open({
      name: DATABASE_NAME,
    });
    console.log('Database opened successfully');
    // Create notes table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        date TEXT,
        summary TEXT
      );
    `);
    console.log('Notes table created/verified');

    // Create embeddings as a virtual table using vec0
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
        id TEXT PRIMARY KEY,
        noteId TEXT,
        chunk TEXT,
        embedding FLOAT[${EMBEDDING_DIMENSIONS}],
      );
    `);
    console.log('Embeddings virtual table created/verified');

    database.db = db;
    console.log('Database initialized with sqlite-vec virtual table');
    
    initCallbacks.forEach(callback => callback());
    initCallbacks = [];
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error; // Re-throw to handle in calling code
  }
};

export const getDatabase = () => {
  return database.db;
};

/**
 * Stores an embedding vector with its associated text chunk
 */
export const storeEmbedding = async (
  noteId: string, 
  chunk: string, 
  embedding: number[]
) => {
  console.log('Storing embedding:', {
    noteId,
    chunkLength: chunk.length,
    embeddingLength: embedding.length
  });

  const db = getDatabase();
  if (!db) {
    console.error('Database not initialized in storeEmbedding');
    return;
  }

  const id = Math.random().toString(36).substring(7);
  console.log('Generated embedding ID:', id);
  
  try {
    const embeddingJson = JSON.stringify(embedding);
    console.log('Inserting embedding into database', {
      id,
      noteId,
      chunkPreview: chunk.substring(0, 50) + '...',
      embeddingJsonLength: embeddingJson.length
    });

    await db.execute(
      `INSERT INTO embeddings (id, noteId, chunk, embedding) 
       VALUES (?, ?, ?, ?)`,
      [id, noteId, chunk, embeddingJson]
    );
    console.log('Successfully stored embedding');
  } catch (error) {
    console.error('Error storing embedding:', {
      error,
      noteId,
      embeddingId: id
    });
    throw error; // Re-throw to handle in calling code
  }
};

/**
 * Finds similar chunks using vector similarity search
 */
export const findSimilarChunks = async (
  embedding: number[] | null,
  limit: number = 5
): Promise<Array<{ noteId: string; chunk: string; distance: number }>> => {
  
  if (!embedding) {
    console.error('Embedding is null in findSimilarChunks');
    return [];
  }

  console.log('Finding similar chunks:', {
    embeddingLength: embedding.length,
    limit
  });

  const db = getDatabase();
  if (!db) {
    console.error('Database not initialized in findSimilarChunks');
    return [];
  }

  try {
    const embeddingJson = JSON.stringify(embedding);
    console.log('Executing similarity search query');

    const { rows } = await db.execute(
      `SELECT noteId, chunk, distance
       FROM embeddings
       WHERE embedding MATCH ?
       AND k = ?`,
      [embeddingJson, limit]
    );

    console.log('Search results:', {
      numberOfResults: rows.length,
      firstResultDistance: rows[0]?.distance
    });

    return rows.map(row => ({
      noteId: row.noteId,
      chunk: row.chunk,
      distance: row.distance
    }));
  } catch (error) {
    console.error('Error finding similar chunks:', error);
    return [];
  }
};

/**
 * Deletes embeddings for a specific note
 */
export const deleteNoteEmbeddings = async (noteId: string) => {
  console.log('Deleting embeddings for note:', noteId);

  const db = getDatabase();
  if (!db) {
    console.error('Database not initialized in deleteNoteEmbeddings');
    return;
  }

  try {
    await db.execute(
      'DELETE FROM embeddings WHERE noteId = ?',
      [noteId]
    );
    console.log('Successfully deleted embeddings for note:', noteId);
  } catch (error) {
    console.error('Error deleting note embeddings:', {
      error,
      noteId
    });
    throw error;
  }
}; 