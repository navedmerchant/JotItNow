/**
 * Main application component that sets up navigation and Redux store.
 * The app uses a stack navigator for main navigation and a tab navigator for the note creation flow.
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { initDatabase } from './services/database';

// Screen imports
import NoteListScreen from './screens/NoteListScreen';
import RecordScreen from './screens/RecordScreen';
import ChatScreen from './screens/ChatScreen';

// Type definitions
export type RootStackParamList = {
  NoteList: undefined;  // Main screen showing list of notes
  NewNote: undefined;   // Screen for creating new notes
};

export type TabParamList = {
  Record: undefined;    // Tab for recording and transcribing audio
  Chat: undefined;      // Tab for chatting with context
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createMaterialTopTabNavigator<TabParamList>();

/**
 * Tab navigator component for the note creation flow.
 * Contains two tabs: Record (for audio recording) and Chat (for conversations).
 */
const NewNoteTabNavigator = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Record" 
        component={RecordScreen}
        options={{ title: 'Record Note' }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root component that initializes the database and sets up the navigation structure.
 */
const App = () => {
  // Initialize SQLite database on app start
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="NoteList" 
            component={NoteListScreen}
            options={{ title: 'My Notes' }}
          />
          <Stack.Screen 
            name="NewNote" 
            component={NewNoteTabNavigator}
            options={{ title: 'New Note' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

export default App;
