/**
 * Main screen that displays a list of all notes.
 * Notes are grouped and ordered by date, with a FAB for creating new notes.
 */

import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { View, FlatList, StyleSheet, AppState, TouchableOpacity, Text, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import NoteItem from '../components/NoteItem';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { fetchNotes, deleteNote } from '../store/noteSlice';
import { AppDispatch } from '../store/store';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { onDatabaseInitialized } from '../services/database';
import { setContextLimit } from 'llama.rn';
import { loadLlamaContext, unloadLlamaContext } from '../services/llama';
import { loadVectorContext, unloadVectorContext } from '../services/vector';
import { setActiveNoteId } from '../store/uiSlice';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type NoteListScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NoteList'>;
};

const NoteListScreen: React.FC<NoteListScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  // Get notes from Redux store
  const notes = useSelector((state: RootState) => state.notes.notes);
  const loading = useSelector((state: RootState) => state.notes.loading);

  setContextLimit(5);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        loadVectorContext();
        loadLlamaContext();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('App has gone to the background!');
        unloadLlamaContext();
        console.log('Llama context unloaded');
        unloadVectorContext();
        console.log('Vector context unloaded');
      }

      appState.current = nextAppState;
    });
  }, []);

  // Fetch notes when component mounts
  useFocusEffect(
    React.useCallback(() => {
      console.log('useFocusEffect: Fetching notes');
      dispatch(fetchNotes());
    }, [])
  );

  useEffect(() => {
    console.log('useEffect: Fetching notes');
    dispatch(fetchNotes());
    loadVectorContext();
    loadLlamaContext();
  }, []);

  useEffect(() => {
    // Register callback for database initialization
    onDatabaseInitialized(() => {
      console.log('Database initialized, fetching notes');
      dispatch(fetchNotes());
    });
  }, []);

  const renderRightActions = (noteId: string) => {
    return (
      <View style={styles.rightActionsContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Delete Note',
              'Are you sure you want to delete this note?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  onPress: () => dispatch(deleteNote(noteId)),
                  style: 'destructive',
                },
              ]
            );
          }}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <TouchableOpacity 
        style={styles.newNoteButton}
        onPress={() => {
          dispatch(setActiveNoteId(null));
          navigation.navigate('NewNote', { screen: 'Record' });
        }}
      >
        <View style={styles.newNoteContent}>
          <Plus size={24} color="#fff" />
          <Text style={styles.newNoteText}>New Note</Text>
        </View>
      </TouchableOpacity>
      <FlatList
        data={notes}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => item.id ? renderRightActions(item.id) : null}
            rightThreshold={40}
          >
            <NoteItem 
              note={item} 
              onPress={() => {
                dispatch(setActiveNoteId(item.id || null));
                navigation.navigate('NewNote', { screen: 'Record' });
              }}
            />
          </Swipeable>
        )}
        keyExtractor={(item) => item.id || uuidv4()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
  },
  list: {
    flex: 1,
    backgroundColor: '#1c1c1c',
  },
  listContent: {
    paddingVertical: 8,
  },
  rightActionsContainer: {
    marginVertical: 4,
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  newNoteButton: {
    backgroundColor: '#2c2c2c',
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    padding: 16,
    marginLeft: 20,
    marginRight: 20
  },
  newNoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newNoteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NoteListScreen; 