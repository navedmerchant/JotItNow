import { configureStore } from '@reduxjs/toolkit';
import noteReducer from './noteSlice';
import chatReducer from './chatSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    notes: noteReducer,
    chat: chatReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 