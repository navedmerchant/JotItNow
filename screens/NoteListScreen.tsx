/**
 * Main screen that displays a list of all notes.
 * Notes are grouped and ordered by date, with a FAB for creating new notes.
 */

import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { View, FlatList, StyleSheet, AppState, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import NoteItem from '../components/NoteItem';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { fetchNotes } from '../store/noteSlice';
import { AppDispatch } from '../store/store';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { onDatabaseInitialized } from '../services/database';
import { setContextLimit } from 'llama.rn';
import { loadLlamaContext, unloadLlamaContext } from '../services/llama';
import { loadVectorContext, unloadVectorContext } from '../services/vector';

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
        console.log('Vector context loaded');
        loadLlamaContext();
        console.log('Llama context loaded');
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
    console.log('Vector context loaded');
    loadLlamaContext();
    console.log('Llama context loaded');
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('NewNote')}
          style={{ marginRight: 16 }}
        >
          <Plus size={24} color="#000" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    // Register callback for database initialization
    onDatabaseInitialized(() => {
      console.log('Database initialized, fetching notes');
      dispatch(fetchNotes());
    });
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        renderItem={({ item }) => (
          <NoteItem 
            note={item} 
            onPress={() => navigation.navigate('NewNote', { 
              screen: 'Record',
              params: { noteId: item.id }
            })}
          />
        )}
        keyExtractor={(item) => item.id || uuidv4()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default NoteListScreen; 