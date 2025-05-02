import { StyleSheet, Image, Platform } from 'react-native';

import { Collapsible } from '@/components/Collapsible';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TextInput, View, FlatList, Text } from 'react-native';
import {useState} from 'react';

{/*
export default function SearchScreen() {
  const initialData = [
    {id: '1', name: 'Robotics'}, 
    {id:'2', name: 'AI'}, 
    {id:'3', name: 'Writing'}, 
    {id:'3', name: 'Sports'}, 
  ];
  const [searchText, setSearchText] = useState('');
  const [filteredData, setFilteredData] = useState(initialData);
  const handleSearch = (text: string) => {
    setSearchText(text);
  
    if (text.trim() === '') {
      setFilteredData(initialData);
      return;
    }
  
    const filtered = initialData.filter(item =>
      item.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredData(filtered);
  };
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={(
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      )}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Search for Users</ThemedText>
      </ThemedView>

      <ThemedText>Implement search bar with filter controls</ThemedText>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
*/}