/**
 * Component for rendering individual note items in the list.
 * Displays note title, date, and a preview of the content.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';

interface NoteItemProps {
  note: {
    id?: string;
    title: string;
    content: string;
    date: string;
    summary?: string;
  };
  onPress?: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container}>
      {/* Note date */}
      <Text style={styles.date}>
        {format(new Date(note.date), 'MMM dd, yyyy')}
      </Text>
      {/* Note title */}
      <Text style={styles.title}>{note.title}</Text>
      {/* Content preview */}
      <Text style={styles.preview} numberOfLines={2}>
        {note.content?.replace('--- Voice Transcription ---', '').trim()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2c2c2c',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  preview: {
    fontSize: 14,
    color: '#ccc',
  },
});

export default NoteItem; 