import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  activeNoteId: string | null;
}

const initialState: UiState = {
  activeNoteId: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveNoteId: (state, action: PayloadAction<string | null>) => {
      state.activeNoteId = action.payload;
    },
  },
});

export const { setActiveNoteId } = uiSlice.actions;
export default uiSlice.reducer; 