import { useState, useEffect } from 'react';
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
import { db, storage, auth as firebaseAuth } from '../../firebase';
import { useAuth } from '../_layout';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LIGHT_PURPLE = '#e7e0ec';
const DARK_PURPLE = '#6750a4';

interface Project {
  id: string;
  title: string;
  tags: string;
  description: string;
  username: string;
  pfp?: any;
}

export default function Feed() {
  const [createModal, setCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const { user: authUser } = useAuth(); // Make sure this is declared at the top
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProjects: Project[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          tags: data.tags,
          description: data.description,
          username: data.username,
          pfp: data.photoURL
            ? { uri: data.photoURL }
            : require('@/assets/images/pfp.png'),
        };
      });

      setProjects(fetchedProjects);
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const fetchUserTags = async () => {
      if (!authUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const tagsFromDB = Array.isArray(data.tags)
            ? data.tags.map((tag: string) => tag.trim().toLowerCase())
            : [];
          setUserTags(tagsFromDB);
        }
      } catch (error) {
        console.error('Error fetching user tags:', error);
      }
    };

    fetchUserTags();
  }, [authUser]);

  const [userTags, setUserTags] = useState<string[]>([]);

  //post algorithm on feed: if the user has certain tags in common with posts, those get displayed first and THEN,
  // if you don't share any common tags, then just sort based on firebase order (descending order of posts created)
  const rankedProjects = [...projects].sort((a, b) => {
    const aTags = a.tags.split(',').map((tag) => tag.trim().toLowerCase());
    const bTags = b.tags.split(',').map((tag) => tag.trim().toLowerCase());

    const aMatches = aTags.filter((tag) => userTags.includes(tag)).length;
    const bMatches = bTags.filter((tag) => userTags.includes(tag)).length;

    // Higher match count = higher rank (i.e., A should come earlier if I have 2 vs 1 tags in common)
    if (aMatches !== bMatches) return bMatches - aMatches;

    return 0;
  });

  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handlePost = async () => {
    if (!authUser) {
      Alert.alert('Error', 'You must be logged in to post.');
      return;
    }

    if (!title.trim() || !tags.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please fill out all fields.');
      return;
    }

    try {
      const newPost = {
        title: title.trim(),
        tags: tags.trim(),
        description: description.trim(),
        uid: authUser.uid,
        username: authUser.displayName || 'Anonymous',
        photoURL: authUser.photoURL || null,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'posts'), {
        ...newPost,
        createdAt: serverTimestamp(), // consistent across timezones
      });

      setTitle('');
      setTags('');
      setDescription('');
      setCreateModal(false);
    } catch (error) {
      console.error('Error posting project:', error);
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (text.trim() === '') return;
    router.push(`/search-results?query=${encodeURIComponent(text)}`);
  };

  // Open request to join project modal
  const openRequestModal = (project: Project) => {
    setSelectedProject(project);
    setRequestModalVisible(true);
  };

  // Send a join request
  const handleSendRequest = (message: string) => {
    console.log('Request sent for project:', selectedProject?.title);
    console.log('Message:', message);

    setRequestModalVisible(false);
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
        {/* The top most common project shared with user */}
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
          {/* The rest of algorithm established in rankedProjects  */}
          {rankedProjects.map((project) => (
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
                    <ThemedText style={styles.tagText}>{tag.trim()}</ThemedText>
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
          ))}
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
