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

// Screen imports
import NoteListScreen from './screens/NoteListScreen';
import RecordScreen from './screens/RecordScreen';
import ChatScreen from './screens/ChatScreen';
import { MenuProvider } from 'react-native-popup-menu';

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
              options={{ title: 'My Notes' }}
            />
            <Stack.Screen 
              name="NewNote" 
              component={NewNoteTabNavigator}
              options={{ title: 'New Note' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </MenuProvider>
    </Provider>
  );
};

const menuProviderStyles = {
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    opacity: 1,
  },
};

export default App;
