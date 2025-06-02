import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Text,
  TextInput,
  ActivityIndicator as PaperActivityIndicator,
  HelperText,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

import { ThemedView } from '@/components/ThemedView';
import TagSelector from '@/components/TagSelector';
import { useAuth } from '../_layout';
import { db, storage, auth as firebaseAuth } from '../../firebase';

interface UserProfileData {
  name: string;
  major: string;
  bio: string;
  tags: string[];
  photoURL: string | null;
  friendsCount: number;
  projectsCount: number;
  thumbsCount: number;
  profileColor: string;
}

// Helper for loading view
const LoadingView = ({ text }: { text: string }) => (
  <ThemedView style={[styles.container, styles.centerContent]}>
    <PaperActivityIndicator size="large" />
    <Text style={{marginTop: 10}}>{text}</Text>
  </ThemedView>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();

  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditing, setEditing] = useState(false);

  // Draft states for editing
  const [draftName, setDraftName] = useState('');
  const [draftMajor, setDraftMajor] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | undefined | null>(null);
  const [draftColor, setDraftColor] = useState('#ff8c00');

  // Social stats are not directly editable by the user on this form
  // They would be updated by other app logic (e.g., adding a friend, creating a project)

  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (authUser) {
      setLoadingProfile(true);
      try {
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data() as UserProfileData; // Cast to defined type
          setProfileData(data);
          // Initialize draft states when data is fetched
          setDraftName(data.name || '');
          setDraftMajor(data.major || '');
          setDraftBio(data.bio || '');
          setDraftTags(data.tags || []);
          setDraftPhotoUri(data.photoURL || null);
          setDraftColor(data.profileColor || '#ff8c00');
          // Social stats are displayed directly from profileData, not part of draft editing here
        } else {
          Alert.alert("Error", "No profile data found. Please complete your profile if you haven't.");
          // Potentially redirect to a profile creation/completion screen if necessary,
          // though sign-up should create this.
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        Alert.alert("Error", "Could not fetch profile data.");
      } finally {
        setLoadingProfile(false);
      }
    } else if (!authLoading) {
        setLoadingProfile(false); // No user, so not loading profile
    }
  }, [authUser, authLoading]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);


  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setDraftPhotoUri(result.assets[0].uri);
    }
  };

  const uploadImageAsync = async (uri: string): Promise<string | null> => {
    if (!authUser) return null;
    setUploadingImage(true);
    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = (e) => { console.error(e); reject(new TypeError("Network request failed")); };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    try {
      if (profileData?.photoURL && profileData.photoURL.includes('firebasestorage.googleapis.com')) {
          try { await deleteObject(ref(storage, profileData.photoURL)); }
          catch (deleteError: any) { console.warn("Could not delete old photo:", deleteError.message); }
      }
      const storageRef = ref(storage, `profile_pictures/${authUser.uid}/${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      return new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null,
          (error) => { console.error("Upload error:", error); (blob as any).close(); reject(error); },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            (blob as any).close(); resolve(downloadURL);
          }
        );
      });
    } catch (e) { console.error(e); Alert.alert("Upload Failed"); return null; }
    finally { setUploadingImage(false); }
  };

  const saveEdits = async () => {
    if (!authUser) { Alert.alert("Error", "Not logged in."); return; }
    if (draftTags.length !== 3 && isEditing) { Alert.alert("Validation Error", "Please select exactly 3 tags."); return; }
    if (!draftName.trim()) { Alert.alert("Validation Error", "Name cannot be empty."); return; }

    setLoadingProfile(true); // Use general loading state for saving
    let newPhotoURL = profileData?.photoURL;

    try {
      if (draftPhotoUri && draftPhotoUri !== profileData?.photoURL && !draftPhotoUri.startsWith('http')) {
        newPhotoURL = await uploadImageAsync(draftPhotoUri) || newPhotoURL;
      } else if (draftPhotoUri === null && profileData?.photoURL) {
         if (profileData.photoURL.includes('firebasestorage.googleapis.com')) {
            try { await deleteObject(ref(storage, profileData.photoURL)); newPhotoURL = null; }
            catch (deleteError: any) { console.warn("Could not delete photo:", deleteError.message); }
        } else { newPhotoURL = null; }
      }

      const userDocRef = doc(db, 'users', authUser.uid);
      // Prepare data for update, keeping existing social stats unless they are meant to be updated here
      const updatedData: Partial<UserProfileData> = { // Use Partial if not all fields are updated
        name: draftName.trim(),
        major: draftMajor.trim(),
        bio: draftBio.trim(),
        tags: draftTags,
        photoURL: newPhotoURL,
        updatedAt: serverTimestamp(),
        profileColor: draftColor,
        // Social stats (friendsCount, projectsCount, thumbsCount) are NOT updated here
        // They are initialized at sign-up and updated by other app logic
      };
      await updateDoc(userDocRef, updatedData);

      // Refresh local profile data optimistically or re-fetch
      setProfileData((prev) => ({
        ...prev!, // Assert prev is not null
        ...updatedData,
        photoURL: newPhotoURL, // Ensure photoURL is correctly updated in local state
      }));
      setEditing(false);
      Alert.alert("Profile Updated", "Your changes have been saved.");
    } catch (error) { console.error("Error updating profile:", error); Alert.alert("Error", "Could not update profile."); }
    finally { setLoadingProfile(false); setUploadingImage(false); }
  };

  const cancelEdits = () => {
    if (profileData) {
      setDraftName(profileData.name || '');
      setDraftMajor(profileData.major || '');
      setDraftBio(profileData.bio || '');
      setDraftTags(profileData.tags || []);
      setDraftPhotoUri(profileData.photoURL || null);
    }
    setEditing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", onPress: async () => {
            try { await firebaseAuth.signOut(); router.replace('/login'); }
            catch (error) { console.error("Logout error: ", error); Alert.alert("Error", "Failed to logout."); }
        }}
    ]);
  };

  if (authLoading || loadingProfile) {
    return <LoadingView text="Loading Profile..." />;
  }
  if (!authUser && !authLoading) {
    return (
        <ThemedView style={[styles.container, styles.centerContent]}>
            <Text>Please login to view your profile.</Text>
            <Button onPress={() => router.replace('/login')}>Go to Login</Button>
        </ThemedView>
    );
  }
  if (!profileData && authUser) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <Text>Profile data not found. Trying to load...</Text>
        <Button onPress={fetchProfile} disabled={loadingProfile}>Retry</Button>
        <Button onPress={handleLogout} style={{marginTop: 20}}>Logout</Button>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.scrollContainer}>
    <ThemedView style={styles.container}>
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.center}>
          <TouchableOpacity onPress={isEditing ? pickImage : undefined} disabled={!isEditing || uploadingImage}>
            <Avatar.Image
              size={96}
              source={ draftPhotoUri ? { uri: draftPhotoUri } : require('@/assets/images/profile-sample.png')}
            />
            {isEditing && <IconButton icon="camera" style={styles.cameraBtn} size={20} onPress={pickImage} disabled={uploadingImage}/>}
          </TouchableOpacity>
          {uploadingImage && <PaperActivityIndicator style={{marginTop: 5}}/>}

          {isEditing ? (
            <TextInput mode="flat" style={[styles.nameInput, styles.editableField]} value={draftName} onChangeText={setDraftName} placeholder="Your Name"/>
          ) : (
            <Text variant="headlineSmall" style={styles.nameText}>
              {profileData?.name || 'Your Name'}
            </Text>
          )}
          {isEditing ? (
             <TextInput mode="flat" style={[styles.majorInput, styles.editableField]} value={draftMajor} onChangeText={setDraftMajor} placeholder="Your Major"/>
          ) : (
          <Text variant="bodyMedium" style={styles.majorText}>
            {profileData?.major || 'Your Major'}
          </Text>
          )}
        </Card.Content>
      </Card>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/friends' as any)}>
          <Icon source="account-multiple" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            {profileData?.friendsCount !== undefined ? profileData.friendsCount : 0}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem} onPress={() => router.push('/projects' as any)}>
          <Icon source="star" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            {profileData?.projectsCount !== undefined ? profileData.projectsCount : 0}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>Projects</Text>
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Icon source="thumb-up" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            {profileData?.thumbsCount !== undefined ? profileData.thumbsCount : 0}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>Thumbs</Text>
        </View>
      </View>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Bio" />
        <Card.Content>
          {isEditing ? (
            <TextInput mode="outlined" multiline value={draftBio} onChangeText={setDraftBio} style={{ minHeight: 80 }}/>
          ) : (
            <Text variant="bodyMedium">{profileData?.bio || 'Your bio here...'}</Text>
          )}
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Tags" />
        {isEditing ? (
          <Card.Content>
            <TagSelector value={draftTags} onChange={setDraftTags} currentUid={authUser?.uid || "editing-temp"}/>
             <HelperText type="error" visible={draftTags.length !== 3 && draftTags.length > 0}>
                {draftTags.length}/3 selected. Please select exactly 3.
            </HelperText>
          </Card.Content>
        ) : (
          <Card.Content style={styles.rowWrap}>
            {(profileData?.tags || []).map((t: string) => (<Chip key={t} style={styles.chip}>{t}</Chip>))}
          </Card.Content>
        )}
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Profile Color" />
        {isEditing ? (
          <Card.Content style={{ flexDirection: 'row', gap: 10, paddingTop: 8 }}>
            {['#FFE4E1', '#B0E0E6', '#98FB98', '#E6E6FA'].map((color) => (
              <TouchableOpacity
                key={color}                onPress={() => setDraftColor(color)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: color,
                  borderWidth: draftColor === color ? 3 : 0,
                  borderColor: '#000',
                }}
              />
            ))}
          </Card.Content>
        ) : (
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text>Selected Color:</Text>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: profileData?.profileColor || '#ff8c00',
              }}
            />
          </Card.Content>
        )}
      </Card>

      {isEditing ? (
        <View style={styles.editRow}>
          <Button mode="contained" onPress={saveEdits} disabled={loadingProfile || uploadingImage}>
            {loadingProfile || uploadingImage ? 'Saving...' : 'Save'}
          </Button>
          <Button onPress={cancelEdits} disabled={loadingProfile || uploadingImage}>Cancel</Button>
        </View>
      ) : (
        <Button mode="contained" onPress={() => setEditing(true)}> Edit Profile </Button>
      )}
      <Button onPress={handleLogout} style={{marginTop: 20}} mode="outlined"> Logout </Button>
    </ThemedView>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles remain the same as the previous version
const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  container: { flex: 1, padding: 24, gap: 20, backgroundColor: '#f5f5f5' },
  centerContent: { justifyContent: 'center', alignItems: 'center'},
  card: { borderRadius: 16, backgroundColor: 'white' },
  center: { alignItems: 'center', paddingVertical: 10 },
  cameraBtn: { position: 'absolute', right: -10, bottom: -10, backgroundColor: 'lightgrey', borderRadius: 15},
  nameText: { marginTop: 8, fontWeight: 'bold', textAlign: 'center' },
  majorText: { color: 'gray', textAlign: 'center' },
  nameInput: {fontSize: 20, textAlign: 'center'},
  majorInput: {textAlign: 'center'},
  editableField: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginVertical: 2,
    width: '80%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 4,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  statItem: { alignItems: 'center' },
  statNumber: { marginLeft: 4, fontWeight: 'bold' },
  statLabel: { marginTop: 2, fontSize: 12, color: 'gray' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { marginVertical: 4 },
  editRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 8 },
});
