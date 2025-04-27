import { Image, StyleSheet, Platform } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function FeedScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Main Feed!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Your Top 4 Recommended Projects</ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Project 1:</ThemedText> P1
          Description
        </ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Project 2:</ThemedText> P2
          Description
        </ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Project 3:</ThemedText> P3
          Description
        </ThemedText>
        <ThemedText>
          <ThemedText type="defaultSemiBold">Project 4:</ThemedText> P4
          Description
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Project card component</ThemedText>
        <ThemedText>
          Create reusable card UI and pull content from Firestore
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
