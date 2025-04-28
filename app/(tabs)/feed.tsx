import { useState, useRef } from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  View,
  TextInput,
  Button,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const SCREEN_WIDTH = Dimensions.get('window').width; //get the width of the screen being used to add dynamic changes to frontend ui
const SWIPE_THRESHOLD = 0.5 * SCREEN_WIDTH; //how we can style projects currently: tinder-esque
const LIGHT_PURPLE = '#EDE6F6'; //for the colors in style sheet
const DARK_PURPLE = '#6750a4';

const initialProjects = [
  {
    id: 1,
    title: 'CS 278 Assignment',
    tags: 'React, Mobile',
    description:
      'Hey! Please work with me to code a social app for my CS 278 class. I need around 2-3 project partners!',
  },
  {
    id: 2,
    title: 'Song Writing',
    tags: 'Music,  Piano, Producer',
    description:
      'Hey! I really want to produce a song, but I need a really good piano player.',
  },
  {
    id: 3,
    title: 'ArcGIS Map Making',
    tags: 'Climate, Maps',
    description:
      'Hey, Im learning ArcGIS for the first time and would really like help looking through this.',
  },
  {
    id: 4,
    title: 'VR Study',
    tags: 'Education, VR',
    description:
      'Hi! Ive never coded in Unity before, but I really want to make a VR simulation for my thesis. Chat with me if interested.',
  },
];

export default function FeedScreen() {
  const [modal, setModal] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [initialProjectList] = useState(initialProjects);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  //for swiping and finding projects feature:
  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        {
          useNativeDriver: false,
        },
      ),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    }),
  ).current;

  //swiping
  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH;
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const onSwipeComplete = (direction: 'left' | 'right') => {
    const swipedProject = projects[0];
    console.log(`Swiped ${direction}:`, swipedProject.title);

    setProjects((prevProjects) => prevProjects.slice(1));
    position.setValue({ x: 0, y: 0 });
  };

  const handlePost = () => {
    console.log('Post submitted:', { title, tags, description });
    setModal(false);
    setProjects([{ id: Date.now(), title, tags, description }, ...projects]);
    setTitle('');
    setTags('');
    setDescription('');
  };

  const projectSwipe = () => {
    if (projects.length === 0) {
      return (
        <View style={styles.noMoreProjects}>
          <ThemedText type="subtitle">
            There's no more projects available!!
          </ThemedText>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => setProjects(initialProjectList)}
          >
            <ThemedText style={{ color: 'white' }}>
              Want to look at the available projects again?
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const project = projects[0]; //start with first project
    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.card, position.getLayout()]}
      >
        <ThemedText type="title" style={{ paddingBottom: 20 }}>
          {project.title}
        </ThemedText>

        <ThemedText type="subtitle" style={{ paddingBottom: 20 }}>
          {project.tags}
        </ThemedText>
        <ThemedText>{project.description}</ThemedText>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => console.log(`Chat with owner of ${project.title}`)}
        >
          <ThemedText style={{ color: 'white' }}>Chat with Me</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#EDE6F6', dark: DARK_PURPLE }}
        headerImage={
          <Image
            source={require('@/assets/images/1.png')}
            style={styles.reactLogo}
          />
        }
      >
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={{ fontSize: 30, color: '#1D3D47' }}>
            Welcome, John Doe
          </ThemedText>
        </ThemedView>

        <View style={styles.feedContainer}>{projectSwipe()}</View>
      </ParallaxScrollView>

      {/* Button to add a project */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModal(true)}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Create a modal that appears when clicking the "+" button */}
      <Modal
        visible={modal}
        animationType="slide"
        onRequestClose={() => setModal(false)} // initially the modal is not visible unless the user wants to make a project
      >
        <View style={styles.modalStyle}>
          <View style={styles.modalContent}>
            <ThemedText type="title">Create New Project</ThemedText>

            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />
            <TextInput
              placeholder="Tags (separate tags with commas)"
              value={tags}
              onChangeText={setTags}
              style={styles.input}
            />
            <TextInput
              placeholder="Project Description"
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, { height: 100 }]}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => setModal(false)}
              >
                <ThemedText style={{ color: 'white' }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chatButton} onPress={handlePost}>
                <ThemedText style={{ color: 'white' }}>Post Project</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    fontFamily: 'SpaceMono',
  },
  refreshButton: {
    marginTop: 20,
    backgroundColor: DARK_PURPLE,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#39298c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reactLogo: {
    height: 150,
    width: SCREEN_WIDTH,
    bottom: 50,
    left: 0,
    position: 'absolute',
  },
  feedContainer: {
    flex: 1,
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    minHeight: 500,
  },
  card: {
    width: '100%',
    backgroundColor: LIGHT_PURPLE,
    padding: 30,
    borderRadius: 20,
    marginVertical: 12,
    shadowColor: '#39298c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  chatButton: {
    backgroundColor: DARK_PURPLE,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  postButton: {
    backgroundColor: DARK_PURPLE,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    backgroundColor: DARK_PURPLE,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#39298c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 7,
  },
  modalStyle: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: LIGHT_PURPLE,
    padding: 24,
    borderRadius: 20,
    gap: 16,
    shadowColor: '#39298c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    fontFamily: 'SpaceMono',
  },
  input: {
    borderWidth: 1,
    borderColor: DARK_PURPLE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#EDE6F6',
    fontFamily: 'SpaceMono',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  noMoreProjects: {
    marginTop: 50,
    alignItems: 'center',
    gap: 16,
    backgroundColor: LIGHT_PURPLE,
    padding: 20,
    borderRadius: 20,
  },
});
