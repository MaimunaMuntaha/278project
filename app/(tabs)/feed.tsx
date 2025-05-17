import { useState } from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  View,
  TextInput,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { router } from 'expo-router';
import ProjectRequestModal from '@/components/ProjectRequestModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LIGHT_PURPLE = '#e7e0ec';
const DARK_PURPLE = '#6750a4';

interface Project {
  id: number;
  title: string;
  tags: string;
  description: string;
  pfp?: any;
}

const initialProjects = [
  {
    id: 1,
    title: 'CS 278 Assignment',
    tags: 'React, Mobile',
    description:
      'Hey! Please work with me to code a social app for my CS 278 class. I need around 2-3 project partners!',
    username: 'John Doe',
    pfp: require('@/assets/images/pfp.png'),
  },
  {
    id: 2,
    title: 'Song Writing',
    tags: 'Music, Piano, Producer',
    description:
      'Hey! I really want to produce a song, but I need a really good piano player.',
    username: 'John Doe',
    pfp: require('@/assets/images/pfp.png'),
  },
  {
    id: 3,
    title: 'ArcGIS Map Making',
    tags: 'Climate, Maps',
    description:
      'Hey, Im learning ArcGIS for the first time and would really like help looking through this.',
    username: 'John Doe',
    pfp: require('@/assets/images/pfp.png'),
  },
  {
    id: 4,
    title: 'VR Study',
    tags: 'Education, VR',
    description:
      'Hi! Ive never coded in Unity before, but I really want to make a VR simulation for my thesis. Chat with me if interested.',
    username: 'John Doe',
    pfp: require('@/assets/images/pfp.png'),
  },
];

export default function Feed() {
  const [createModal, setCreateModal] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [searchText, setSearchText] = useState('');

  // State for join request modal
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handlePost = () => {
    console.log('Post submitted:', { title, tags, description });
    setCreateModal(false);
    setProjects([
      {
        id: Date.now(),
        title,
        tags,
        description,
        username: 'John Doe',
        pfp: require('@/assets/images/pfp.png'),
      },
      ...projects,
    ]);
    setTitle('');
    setTags('');
    setDescription('');
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (text.trim() === '') return;
    router.push(`/search-results?query=${encodeURIComponent(text)}`);
  };

  // Handle opening the request modal
  const openRequestModal = (project: Project) => {
    setSelectedProject(project);
    setRequestModalVisible(true);
  };

  // Handle sending a join request
  const handleSendRequest = (message: string) => {
    console.log('Request sent for project:', selectedProject?.title);
    console.log('Message:', message);

    // Here you would typically send this to your backend
    // For now, we'll just show a success message
    setRequestModalVisible(false);

    // Show success alert
    Alert.alert(
      'Request Sent',
      'Your request to join this project has been sent. The project creator will be in touch if they accept.',
      [{ text: 'OK' }],
    );
  };

  const renderProject = ({ item }: { item: Project }) => (
    <View style={styles.card}>
      <ThemedText type="title" style={{ paddingBottom: 20 }}>
        {item.title}
      </ThemedText>
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap',
          paddingBottom: 10,
        }}
      >
        {item.tags.split(',').map((tag, i) => (
          <View key={i} style={styles.tag}>
            <ThemedText style={styles.tagText}>{tag.trim()}</ThemedText>
          </View>
        ))}
      </View>
      <ThemedText>{item.description}</ThemedText>
      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => openRequestModal(item)}
      >
        <ThemedText style={{ color: 'white' }}>
          Request to Join Project
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: LIGHT_PURPLE, dark: DARK_PURPLE }}
        headerImage={
          <Image
            source={require('@/assets/images/1.png')}
            style={styles.reactLogo}
            resizeMode="contain"
          />
        }
      >
        <ThemedView style={styles.titleContainer}>
          <ThemedText
            type="title"
            style={{ fontSize: 30, color: '#1D3D47', marginTop: 20 }}
          >
            Welcome, John Doe
          </ThemedText>
        </ThemedView>
        <TextInput
          placeholder="Search projects..."
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => {
            if (searchText.trim().length >= 2) {
              router.push(
                `/search-results?query=${encodeURIComponent(searchText.trim())}`,
              );
            }
          }}
          returnKeyType="search"
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 8,
            padding: 12,
            margin: 16,
            backgroundColor: '#fff',
          }}
        />
        {/* How the posts should appear through Flatlist (will be clearer when backend is created and projects can be added to backend) */}
        <View style={styles.feedContainer}>
          <View style={[styles.card, { backgroundColor: '#dfe7fd' }]}>
            <ThemedText
              type="title"
              style={{ paddingBottom: 10, fontSize: 18, color: DARK_PURPLE }}
            >
              Hey (insert username)! Based on your profile and past projects,
              this looks like a good fit:
            </ThemedText>
            <View
              style={{
                backgroundColor: '#fff',
                padding: 20,
                borderRadius: 16,
                shadowColor: DARK_PURPLE,
                shadowOpacity: 0.15,
                shadowOffset: { width: 0, height: 3 },
                marginTop: 10,
              }}
            >
              <ThemedText type="title" style={{ paddingBottom: 10 }}>
                VR Study
              </ThemedText>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  flexWrap: 'wrap',
                  paddingBottom: 10,
                }}
              >
                {['Education', 'VR'].map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <ThemedText style={styles.tagText}>{tag}</ThemedText>
                  </View>
                ))}
              </View>
              <ThemedText>
                Hi! I've never coded in Unity before, but I really want to make
                a VR simulation for my thesis. Chat with me if interested.
              </ThemedText>
              <TouchableOpacity
                style={[styles.chatButton, { marginTop: 16 }]}
                onPress={() =>
                  openRequestModal({
                    id: 4,
                    title: 'VR Study',
                    tags: 'Education, VR',
                    description:
                      'Hi! Ive never coded in Unity before, but I really want to make a VR simulation for my thesis. Chat with me if interested.',
                    username: 'John Doe',
                    pfp: require('@/assets/images/pfp.png'),
                  })
                }
              >
                <ThemedText style={{ color: 'white' }}>
                  Request to Join Project
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {projects.length > 0 ? (
            projects.map((project) => (
              <View key={project.id.toString()} style={styles.card}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Image
                    source={
                      project.pfp
                        ? project.pfp
                        : require('@/assets/images/pfp.png')
                    }
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      marginRight: 12,
                    }}
                  />
                  <ThemedText style={{ fontWeight: '600', fontSize: 16 }}>
                    {project.username}
                  </ThemedText>
                </View>

                <ThemedText type="title" style={{ paddingBottom: 20 }}>
                  {project.title}
                </ThemedText>
                {/* Rest of your project card content */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingBottom: 10,
                  }}
                >
                  {project.tags.split(',').map((tag, i) => (
                    <View key={i} style={styles.tag}>
                      <ThemedText style={styles.tagText}>
                        {tag.trim()}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                <ThemedText>{project.description}</ThemedText>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => openRequestModal(project)}
                >
                  <ThemedText style={{ color: 'white' }}>
                    Request to Join Project
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.noMoreProjects}>
              <ThemedText type="subtitle">
                There's no more projects available!!
              </ThemedText>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => setProjects(initialProjects)}
              >
                <ThemedText style={{ color: 'white' }}>
                  Want to look at the available projects again?
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ParallaxScrollView>

      {/*This is the add posts button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setCreateModal(true)}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/*When adding a post, a modal appears */}
      <Modal
        visible={createModal}
        animationType="slide"
        onRequestClose={() => setCreateModal(false)}
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
                onPress={() => setCreateModal(false)}
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

      {/* Join Project Request Modal */}
      {selectedProject && (
        <ProjectRequestModal
          visible={requestModalVisible}
          projectTitle={selectedProject.title}
          onClose={() => setRequestModalVisible(false)}
          onSend={handleSendRequest}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    alignItems: 'center',
  },
  refreshButton: {
    marginTop: 20,
    backgroundColor: DARK_PURPLE,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: DARK_PURPLE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
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
    shadowColor: DARK_PURPLE,
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
    shadowColor: DARK_PURPLE,
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
  },
  input: {
    borderWidth: 1,
    borderColor: DARK_PURPLE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: LIGHT_PURPLE,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  tag: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: DARK_PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderColor: DARK_PURPLE,
  },
  tagText: {
    fontSize: 16,
    color: DARK_PURPLE,
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
