const { query } = useLocalSearchParams();
console.log('query param:', query);
import { useLocalSearchParams } from 'expo-router';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const dummyProjects = [
  { id: '1', title: 'AI Research', tags: ['ai', 'ml'] },
  { id: '2', title: 'React Native Study Group', tags: ['react', 'mobile'] },
  { id: '3', title: 'History Paper', tags: ['history', 'writing'] },
  { id: '4', title: 'VR Jam', tags: ['vr', 'design'] },
];

export default function SearchResultsScreen() {
  const { query } = useLocalSearchParams();

  const results =
  query.length < 2
    ? []
    : dummyProjects.filter(project =>
        project.title.toLowerCase().includes(query) ||
        project.tags.some(tag => tag.toLowerCase().includes(query))
      );
  
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Search Results for "{query}"</Text>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.tags}>{item.tags.join(', ')}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  card: {
    padding: 16,
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '500' },
  tags: { marginTop: 4, color: '#555' },
});