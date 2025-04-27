import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, HelperText, TextInput, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import TagSelector from '@/components/TagSelector'; 

export default function LoginScreen() {
  const router = useRouter();

  const [major,     setMajor]     = useState('');
  const [bio,       setBio]       = useState('');
  const [tags,  setTags]          = useState<string[]>([]);

  /* --- TEMP behaviour ------------------------------------------- */
  const handleStanfordSignIn = () => {
    Alert.alert('Not implemented yet', 'SSO will be added later 🎓');
    router.replace('/feed');    // temp navigation
  };

  const finishProfile = async () => {
    // TODO replace placeholder with real Firestore write
    router.replace('/feed');
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stanford Project Finder</Text>

      <Button mode="contained" onPress={handleStanfordSignIn}>
        Sign in with Stanford
      </Button>

      <TextInput label="Major"
                 value={major}
                 onChangeText={setMajor}
                 style={styles.input} />

      <TextInput label="Bio"
                 value={bio}
                 onChangeText={setBio}
                 multiline
                 style={[styles.input, { minHeight: 80 }]} />

      <Text style={styles.label}>Pick **exactly three** tags</Text>
        <TagSelector
          value={tags}
          onChange={(list) =>
            list.length <= 3 ? setTags(list) : undefined /* ignore extras */
          }
          currentUid="onboarding-temp"   /* replace with auth.currentUser?.uid */
        />
        <HelperText type="error" visible={tags.length !== 3}>
          {tags.length}/3 selected
        </HelperText>

      <Button mode="contained"
              style={styles.submitButton}
              onPress={finishProfile}>
        Complete Profile
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title:         { fontSize: 28, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  input:         { marginVertical: 8 },
  label:         { marginTop: 12, fontWeight: '600' },
  submitButton:  { marginTop: 20 },
});
