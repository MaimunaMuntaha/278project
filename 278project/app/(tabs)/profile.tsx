import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";

import { ThemedView } from "@/components/ThemedView";
import TagSelector from "@/components/TagSelector";

export default function ProfileScreen() {
  /* ------------------------------------------------------------------ */
  /* local mock state (replace with Firestore in prod)                   */
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [bio, setBio]           = useState("I love building social apps!");
  const [tags, setTags]         = useState<string[]>([
    "Earth System",
    "Freelance",
    "Miscellaneous",
  ]);

  const [isEditing, setEditing]   = useState(false);
  const [draftBio, setDraftBio]   = useState(bio);
  const [draftTags, setDraftTags] = useState(tags);

  /* ------------------------------------------------------------------ */
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const onSave = () => {
    setBio(draftBio.trim());
    setTags(draftTags);
    setEditing(false);
  };

  const onCancel = () => {
    setDraftBio(bio);
    setDraftTags(tags);
    setEditing(false);
  };

  /* ------------------------------------------------------------------ */
  return (
    <ThemedView style={styles.container}>
      {/* ---------- avatar / name / major ---------------------------- */}
      <Card style={styles.card}>
        <Card.Content style={styles.center}>
          <Avatar.Image
            size={96}
            source={
              photoUri ? { uri: photoUri } : require("@/assets/images/icon.png")
            }
          />
          {isEditing && (
            <IconButton
              icon="camera"
              size={20}
              style={styles.cameraBtn}
              onPress={pickImage}
            />
          )}

          <Text variant="titleLarge" style={styles.name}>
            John Doe
          </Text>
          <Text variant="bodyMedium" style={styles.major}>
            Computer Science Major
          </Text>
        </Card.Content>
      </Card>

      {/* --------------------------- Bio ----------------------------- */}
      <Card style={styles.card}>
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

      {/* --------------------------- Tags ---------------------------- */}
      <Card style={styles.card}>
        <Card.Title title="Tags" />
        <Card.Content>
          {isEditing ? (
            <TagSelector
              value={draftTags}
              onChange={setDraftTags}
              currentUid="localUser"  // dummy uid while offline
            />
          ) : (
            <View style={styles.rowWrap}>
              {tags.map((t) => (
                <Chip key={t} style={styles.chip}>
                  {t}
                </Chip>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ------------------------ buttons ---------------------------- */}
      {isEditing ? (
        <View style={styles.editRow}>
          <Button mode="contained" onPress={onSave}>
            Save
          </Button>
          <Button onPress={onCancel}>Cancel</Button>
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
  center: { alignItems: "center" },
  name: { marginTop: 8 },
  major: { color: "gray" },
  cameraBtn: { position: "absolute", right: -6, bottom: -6 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { marginVertical: 4 },
  editRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 8,
  },
});
