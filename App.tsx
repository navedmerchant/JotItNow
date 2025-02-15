/**
 * Main application component that sets up navigation and Redux store.
 * The app uses a stack navigator for main navigation and a tab navigator for the note creation flow.
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { initDatabase } from './services/database';
import { useSelector } from 'react-redux';
import { RootState } from './store/store';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import SummarizeScreen from './screens/SummarizeScreen';

// Screen imports
import NoteListScreen from './screens/NoteListScreen';
import RecordScreen from './screens/RecordScreen';
import ChatScreen from './screens/ChatScreen';

// Type definitions
export type RootStackParamList = {
  NoteList: undefined;
  NewNote: undefined | {
    screen?: string;
    params?: { noteId?: string };
  };
  EditNote: { noteId: string };
};

export type TabParamList = {
  Record: { noteId?: string };    // Tab for recording and transcribing audio
  Summarize: { noteId?: string; transcribedText?: string };
  Chat: { noteId?: string };      // Tab for chatting with context
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createMaterialTopTabNavigator<TabParamList>();

/**
 * Tab navigator component for the note creation flow.
 * Contains two tabs: Record (for audio recording) and Chat (for conversations).
 */
const NewNoteTabNavigator = () => {
  const notes = useSelector((state: RootState) => state.notes.notes);
  const activeNoteId = useSelector((state: RootState) => state.ui.activeNoteId);
  const currentNote = notes.find(note => note.id === activeNoteId);
  const [title, setTitle] = useState(currentNote?.title || 'New Note');

  // Update effect to use activeNoteId
  useEffect(() => {
    console.log('useEffect: Updating title from currentNote', {
      currentNoteTitle: currentNote?.title,
      activeNoteId
    });
    if (currentNote?.title) {
      setTitle(currentNote.title);
    }
  }, [currentNote?.title]);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1c1c1c',
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#007AFF',
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 14,
          textTransform: 'none',
        },
      }}
    >
      <Tab.Screen 
        name="Record" 
        component={RecordScreen}
        initialParams={{ noteId: activeNoteId || undefined }}
        options={{ 
          tabBarLabel: 'Record'
        }}
      />
      <Tab.Screen 
        name="Summarize" 
        component={SummarizeScreen}
        initialParams={{ noteId: activeNoteId || undefined }}
        options={{ 
          tabBarLabel: 'Summarize'
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        initialParams={{ noteId: activeNoteId || undefined }}
        options={{ 
          tabBarLabel: 'Chat'
        }}
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <MenuProvider customStyles={menuProviderStyles}>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#1c1c1c',
                },
                headerTitleStyle: {
                  color: '#fff',
                },
                headerTintColor: '#fff',
                contentStyle: {
                  backgroundColor: '#1c1c1c',
                },
              }}
            >
              <Stack.Screen 
                name="NoteList" 
                component={NoteListScreen}
                options={{ title: 'JotItNow' }}
              />
              <Stack.Screen 
                name="NewNote" 
                component={NewNoteTabNavigator}
                options={{ title: 'Note' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </MenuProvider>
      </Provider>
    </GestureHandlerRootView>
  );
};

const menuProviderStyles = {
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    opacity: 1,
  },
};

export default App;
