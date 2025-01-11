/**
 * Main screen that displays a list of all notes.
 * Notes are grouped and ordered by date, with a FAB for creating new notes.
 */

import React, { useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, AppState } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import NoteItem from '../components/NoteItem';
import { FAB } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { fetchNotes } from '../store/noteSlice';
import { AppDispatch } from '../store/store';
import { v4 as uuidv4 } from 'uuid';

type NoteListScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NoteList'>;
};

const NoteListScreen: React.FC<NoteListScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  // Get notes from Redux store
  const notes = useSelector((state: RootState) => state.notes.notes);
  const loading = useSelector((state: RootState) => state.notes.loading);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('App has gone to the background!');
        // unloadWhisperContext();
      }

      appState.current = nextAppState;
    });
  }, []);

  // Fetch notes when component mounts
  useEffect(() => {
    dispatch(fetchNotes());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        renderItem={({ item }) => <NoteItem note={item} />}
        keyExtractor={(item) => item.id || uuidv4()}
      />
      {/* FAB for creating new notes */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('NewNote')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default NoteListScreen; 