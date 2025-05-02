import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import TagSelector from '@/components/TagSelector';

export default function ProfileScreen() {
  const router = useRouter();

  /* ------------------------------------------------------------------ */
  /* mock local state – replace with Firestore in prod                  */
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [bio, setBio] = useState('I love building social apps!');
  const [tags, setTags] = useState<string[]>([
    'Earth Systems',
    'Freelance',
    'Miscellaneous',
  ]);

  const [isEditing, setEditing] = useState(false);
  const [draftBio, setDraftBio] = useState(bio);
  const [draftTags, setDraftTags] = useState(tags);

  /* ------------------------------------------------------------------ */
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const saveEdits = () => {
    setBio(draftBio);
    setTags(draftTags);
    setEditing(false);
  };
  const cancelEdits = () => {
    setDraftBio(bio);
    setDraftTags(tags);
    setEditing(false);
  };

  /* ------------------------------------------------------------------ */
  return (
    <ThemedView style={styles.container}>
      {/* ---------- avatar, name, major -------------------------------- */}
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.center}>
          <Avatar.Image
            size={96}
            source={
              photoUri
                ? { uri: photoUri }
                : require('@/assets/images/profile-sample.png')
            }
          />
          {isEditing && (
            <IconButton
              icon="camera"
              style={styles.cameraBtn}
              size={20}
              onPress={pickImage}
            />
          )}
          <Text variant="headlineSmall" style={styles.name}>
            John Doe
          </Text>
          <Text variant="bodyMedium" style={styles.major}>
            Computer Science Major
          </Text>
        </Card.Content>
      </Card>

      {/* ---------- stats row ----------------------------------------- */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push('/friends')}
        >
          <Icon source="account-multiple" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            25
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push('/projects')}
        >
          <Icon source="star" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            7
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Projects
          </Text>
        </TouchableOpacity>

        <View style={styles.statItem}>
          <Icon source="thumb-up" size={24} />
          <Text variant="titleMedium" style={styles.statNumber}>
            22
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Thumbs
          </Text>
        </View>
      </View>

      {/* ---------- Bio ---------------------------------------------- */}
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Bio" />
        <Card.Content>
          {isEditing ? (
            <TextInput
              mode="outlined"
              multiline
              value={draftBio}
              onChangeText={setDraftBio}
            />
          ) : (
            <Text variant="bodyMedium">{bio}</Text>
          )}
        </Card.Content>
      </Card>

      {/* ---------- Tags --------------------------------------------- */}
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Tags" />
        {isEditing ? (
          <Card.Content>
            <TagSelector
              value={draftTags}
              onChange={setDraftTags}
              currentUid="demoUser" /* replace with auth.uid */
            />
          </Card.Content>
        ) : (
          <Card.Content style={styles.rowWrap}>
            {tags.map((t) => (
              <Chip key={t} style={styles.chip}>
                {t}
              </Chip>
            ))}
          </Card.Content>
        )}
      </Card>

      {/* ---------- buttons ------------------------------------------ */}
      {isEditing ? (
        <View style={styles.editRow}>
          <Button mode="contained" onPress={saveEdits}>
            Save
          </Button>
          <Button onPress={cancelEdits}>Cancel</Button>
        </View>
      ) : (
        <Button mode="contained" onPress={() => setEditing(true)}>
          Edit Profile
        </Button>
      )}
    </ThemedView>
  );
}

/* -------------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 20 },
  card: { borderRadius: 16 },
  center: { alignItems: 'center' },
  cameraBtn: { position: 'absolute', right: -6, bottom: -6 },
  name: { marginTop: 8 },
  major: { color: 'gray' },

  /* stats ----------------------------------------------------------- */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 4,
  },
  statItem: { alignItems: 'center' },
  statNumber: { marginLeft: 4 },
  statLabel: { marginTop: 2, fontSize: 12, color: 'gray' },

  /* tags ------------------------------------------------------------ */
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { marginVertical: 4 },

  /* edit buttons ---------------------------------------------------- */
  editRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 8,
  },
});
