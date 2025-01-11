import { configureStore } from '@reduxjs/toolkit';
import noteReducer from './noteSlice';
import chatReducer from './chatSlice';

export const store = configureStore({
  reducer: {
    notes: noteReducer,
    chat: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 