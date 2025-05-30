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
import { ChatService } from '../../services/chatService'; // Import ChatService
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
  uid: string; // Add the user ID of the project owner
  pfp?: any;
}

export interface UserData {
  name?: string;
  tags?: string[];
  [key: string]: any; // For other properties
}

export default function Feed() {
  const [createModal, setCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false); // Loading state for sending requests
  const [joinedProjects, setJoinedProjects] = useState<Set<string>>(new Set()); // Track joined projects
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(
    new Set(),
  ); // Track pending requests
  const { user: authUser } = useAuth();

  const [userData, setUserData] = useState<UserData | null>(null);

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
          uid: data.uid, // Include the project owner's user ID
          pfp: data.photoURL
            ? { uri: data.photoURL }
            : require('@/assets/images/pfp.png'), // TODO: do images work?
        };
      });

      setProjects(fetchedProjects);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();

          // Set the complete user data
          setUserData(data);

          console.log('User data fetched:', data);

          // Set tags as before
          const tagsFromDB = Array.isArray(data.tags)
            ? data.tags.map((tag: string) => tag.trim().toLowerCase())
            : [];
          setUserTags(tagsFromDB);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [authUser]);

  // Check which projects the user has already joined
  useEffect(() => {
    const checkJoinedProjects = async () => {
      if (!authUser?.uid || projects.length === 0) return;

      try {
        // Get user's group chats
        const userGroupChats = await ChatService.getUserGroupChats(
          authUser.uid,
        );

        // Create a set of project names the user has joined
        const joinedProjectNames = new Set(
          userGroupChats.map((chat) => chat.projectName.toLowerCase()),
        );

        // Check which projects from the feed the user has joined
        const joinedProjectIds = new Set<string>();
        projects.forEach((project) => {
          if (joinedProjectNames.has(project.title.toLowerCase())) {
            joinedProjectIds.add(project.id);
          }
        });

        setJoinedProjects(joinedProjectIds);
      } catch (error) {
        console.error('Error checking joined projects:', error);
      }
    };

    checkJoinedProjects();
  }, [authUser?.uid, projects]);

  // Check which projects the user has pending requests for
  useEffect(() => {
    const checkPendingRequests = async () => {
      if (!authUser?.uid || projects.length === 0) return;

      try {
        // Get user's sent requests
        const userSentRequests = await ChatService.getUserSentRequests(
          authUser.uid,
        );

        // Create a set of project names the user has pending requests for
        const pendingProjectNames = new Set(
          userSentRequests.map((request) => request.projectName.toLowerCase()),
        );

        // Check which projects from the feed have pending requests
        const pendingProjectIds = new Set<string>();
        projects.forEach((project) => {
          if (pendingProjectNames.has(project.title.toLowerCase())) {
            pendingProjectIds.add(project.id);
          }
        });

        setPendingRequests(pendingProjectIds);
      } catch (error) {
        console.error('Error checking pending requests:', error);
      }
    };

    checkPendingRequests();
  }, [authUser?.uid, projects]);

  // Subscribe to real-time updates for pending requests
  useEffect(() => {
    if (!authUser?.uid) return;

    const unsubscribe = ChatService.subscribeToUserSentRequests(
      authUser.uid,
      (sentRequests) => {
        // Create a set of project names with pending requests
        const pendingProjectNames = new Set(
          sentRequests.map((request) => request.projectName.toLowerCase()),
        );

        // Update pending projects based on current projects in feed
        const pendingProjectIds = new Set<string>();
        projects.forEach((project) => {
          if (pendingProjectNames.has(project.title.toLowerCase())) {
            pendingProjectIds.add(project.id);
          }
        });

        setPendingRequests(pendingProjectIds);
      },
    );

    return () => unsubscribe();
  }, [authUser?.uid, projects]);

  const [userTags, setUserTags] = useState<string[]>([]);

  //post algorithm on feed: if the user has certain tags in common with posts, those get displayed first and THEN,
  // if you don't share any common tags, then just sort based on firebase order (descending order of posts created)
  const projectAlgorithm = [...projects].sort((a, b) => {
    const aTags = a.tags.split(',').map((tag) => tag.trim().toLowerCase());
    const bTags = b.tags.split(',').map((tag) => tag.trim().toLowerCase());

    const aMatches = aTags.filter((tag) => userTags.includes(tag)).length;
    const bMatches = bTags.filter((tag) => userTags.includes(tag)).length;

    // Higher match count = higher rank (i.e., A should come earlier if I have 2 vs 1 tags in common)
    if (aMatches !== bMatches) return bMatches - aMatches;

    return 0;
  });

  const filteredProjects = projectAlgorithm.filter((project) => {
    const query = searchText.trim().toLowerCase();
    if (!query) return true;
    const titleMatch = project.title.toLowerCase().includes(query);
    const tagMatch = project.tags.toLowerCase().includes(query);
    return titleMatch || tagMatch;
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
        username: userData?.name || 'Anonymous',
        photoURL: authUser.photoURL || null,
        createdAt: new Date(),
      };

      // Create the project post
      const postRef = await addDoc(collection(db, 'posts'), {
        ...newPost,
        createdAt: serverTimestamp(), // consistent across timezones
      });

      // Create a corresponding group chat for this project
      const groupChatId = await ChatService.createGroupChat(
        title.trim(), // projectName
        `Group chat for ${title.trim()}`, // description
        authUser.uid, // creatorId
        userData?.name || 'Anonymous', // creatorName
        authUser.email || '', // creatorEmail
      );

      if (groupChatId) {
        console.log(
          `Created group chat ${groupChatId} for project ${postRef.id}`,
        );

        // Optionally, you could store the groupChatId in the post document
        // This would create a direct link between the post and its group chat
        // await updateDoc(postRef, { groupChatId });
      } else {
        console.warn('Failed to create group chat for project');
        // Don't fail the whole operation if group chat creation fails
      }

      setTitle('');
      setTags('');
      setDescription('');
      setCreateModal(false);

      Alert.alert('Success', 'Project posted and group chat created!');
    } catch (error) {
      console.error('Error posting project:', error);
      Alert.alert('Error', 'Failed to create project. Please try again.');
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
  };

  // Open request to join project modal
  const openRequestModal = (project: Project) => {
    // Check if user is trying to request their own project
    if (authUser && project.uid === authUser.uid) {
      Alert.alert('Error', 'You cannot request to join your own project.');
      return;
    }

    // Check if user has already joined this project
    if (joinedProjects.has(project.id)) {
      Alert.alert('Info', 'You are already a member of this project.');
      return;
    }

    // Check if user already has a pending request for this project
    if (pendingRequests.has(project.id)) {
      Alert.alert(
        'Info',
        'You already have a pending request for this project. Please wait for the project owner to respond.',
      );
      return;
    }

    setSelectedProject(project);
    setRequestModalVisible(true);
  };

  // Send a join request
  const handleSendRequest = async (message: string) => {
    if (!authUser || !selectedProject) {
      Alert.alert('Error', 'Authentication or project information missing.');
      return;
    }

    setSendingRequest(true);

    try {
      const requestId = await ChatService.createProjectRequest(
        authUser.uid, // fromUserId
        userData?.name || 'Anonymous', // fromUserName
        authUser.email || '', // fromUserEmail
        selectedProject.uid, // toUserId (project owner)
        selectedProject.title, // projectName
        message, // message
        selectedProject.id, // projectId
      );

      if (requestId) {
        // Immediately update pending requests for instant UI feedback
        setPendingRequests((prev) => new Set(prev).add(selectedProject.id));

        Alert.alert(
          'Request Sent!',
          `Your request to join "${selectedProject.title}" has been sent to ${selectedProject.username}. You'll be notified when they respond.`,
        );
        setRequestModalVisible(false);
        setSelectedProject(null);
      } else {
        Alert.alert(
          'Request Not Sent',
          'A request for this project may already exist or there was an error. Please try again.',
        );
      }
    } catch (error) {
      console.error('Error sending join request:', error);
      Alert.alert('Error', 'Failed to send request. Please try again.');
    } finally {
      setSendingRequest(false);
    }
  };

  // Function to determine button state and render accordingly
  const renderProjectButton = (project: Project) => {
    const isOwner = authUser && project.uid === authUser.uid;
    const isJoined = joinedProjects.has(project.id);
    const isPending = pendingRequests.has(project.id);

    if (isOwner) {
      return (
        <View style={[styles.chatButton, styles.ownProjectButton]}>
          <ThemedText style={{ color: DARK_PURPLE }}>Your Project</ThemedText>
        </View>
      );
    }

    if (isJoined) {
      return (
        <View style={[styles.chatButton, styles.joinedButton]}>
          <View style={styles.joinedButtonContent}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <ThemedText style={styles.joinedButtonText}>Joined</ThemedText>
          </View>
        </View>
      );
    }

    if (isPending) {
      return (
        <View style={[styles.chatButton, styles.pendingButton]}>
          <View style={styles.pendingButtonContent}>
            <Ionicons name="time-outline" size={20} color="#FF9800" />
            <ThemedText style={styles.pendingButtonText}>
              Request Pending
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.chatButton, sendingRequest && styles.disabledButton]}
        onPress={() => openRequestModal(project)}
        disabled={sendingRequest}
      >
        <ThemedText style={{ color: 'white' }}>
          Request to Join Project
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderProject = ({ item }: { item: Project }) => (
    <View style={styles.card}>
      <ThemedText type="title" style={{ paddingBottom: 10 }}>
        {item.title}
      </ThemedText>
      <View
        style={{
          flexDirection: 'row',
          gap: 1,
          flexWrap: 'wrap',
          paddingBottom: 1,
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
            Welcome, {userData?.name || 'User'}
          </ThemedText>
        </ThemedView>
        <TextInput
          placeholder="Search projects..."
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
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
          {/* The rest of algorithm established in projectAlgorithm  */}
          {filteredProjects.map((project) => (
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
                <ThemedText style={{ fontWeight: '500', fontSize: 16 }}>
                  {project.username}
                </ThemedText>
              </View>

              <ThemedText
                type="title"
                style={{ fontSize: 25, paddingBottom: 10 }}
              >
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

              {/* Render appropriate button based on user status */}
              {authUser && renderProjectButton(project)}
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
          onClose={() => {
            setRequestModalVisible(false);
            setSelectedProject(null);
          }}
          onSend={handleSendRequest}
          // loading={sendingRequest} // Pass loading state to modal
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
    height: 170,
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
    minHeight: 300,
  },
  card: {
    width: '100%',
    backgroundColor: LIGHT_PURPLE,
    padding: 16,
    borderRadius: 10,
    marginVertical: 8,
    shadowColor: DARK_PURPLE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  chatButton: {
    backgroundColor: DARK_PURPLE,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  ownProjectButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: DARK_PURPLE,
  },
  joinedButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  joinedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinedButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  pendingButton: {
    backgroundColor: '#fff3e0',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  pendingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingButtonText: {
    color: '#FF9800',
    fontWeight: '600',
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
    borderRadius: 5,
    marginRight: 15,
    shadowColor: DARK_PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderColor: DARK_PURPLE,
  },
  tagText: {
    fontSize: 15,
    color: DARK_PURPLE,
  },
});
