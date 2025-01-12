/**
 * Database service using op-sqlite operations.
 * Handles database initialization and provides access to the database instance.
 */

import { open } from '@op-engineering/op-sqlite';

// Database configuration
const DATABASE_NAME = 'NotesApp.db';

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
 * Called when the application starts.
 */
export const initDatabase = async () => {
  try {
    const db = await open({
      name: DATABASE_NAME,
    });

    // Create notes table for storing note data
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        date TEXT,
        summary TEXT
      );
    `);

    // Create chats table for storing conversation messages
    await db.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        noteId TEXT,
        message TEXT,
        isUser INTEGER,
        timestamp TEXT,
        FOREIGN KEY (noteId) REFERENCES notes (id)
      );
    `);

    database.db = db;
    console.log('Database initialized');
    
    // Call all registered callbacks
    initCallbacks.forEach(callback => callback());
    initCallbacks = []; // Clear callbacks after calling them
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

/**
 * Returns the database instance for performing queries.
 */
export const getDatabase = () => {
  return database.db;
}; 