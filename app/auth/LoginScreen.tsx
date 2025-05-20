// app/auth/LoginScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, HelperText, TextInput, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../firebase';
import TagSelector from '@/components/TagSelector';
import { useAuth } from '../_layout';
import { addGlobalTag, fetchAllTags, seedInitialTags } from '../../constants/tags';

// Helper for loading view
const LoadingView = ({ text }: { text: string }) => (
  <View style={styles.centeredContainer}>
    <ActivityIndicator animating={true} size="large" />
    <Text style={{ textAlign: 'center', marginTop: 10 }}>{text}</Text>
  </View>
);

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user: authenticatedUser, loading: authLoadingStatus } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [bio, setBio] = useState('');
  const [userSelectedTags, setUserSelectedTags] = useState<string[]>([]);
  const [allAvailableTags, setAllAvailableTags] = useState<string[]>([]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [emailInUseError, setEmailInUseError] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      if (isSignUp) { // Only load tags if on the sign-up form
        console.log("LoginScreen: Fetching all available tags for TagSelector...");
        const fetchedTags = await fetchAllTags();
        setAllAvailableTags(fetchedTags);
        console.log(`LoginScreen: Loaded ${fetchedTags.length} tags.`);
      }
    };
    loadTags();
    // Consider a more controlled way to seed tags, e.g., an admin function or a one-time script.
    // seedInitialTags();
  }, [isSignUp]);

  const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: NodeJS.Timeout | null = null;
    const debounced = (...args: Parameters<F>) => {
      if (timeout !== null) { clearTimeout(timeout); timeout = null; }
      timeout = setTimeout(() => func(...args), waitFor);
    };
    return debounced as (...args: Parameters<F>) => ReturnType<F>;
  };

  const checkEmailAvailability = useCallback(async (currentEmail: string) => {
    if (!isSignUp || !currentEmail.trim().toLowerCase().endsWith('@stanford.edu')) {
      setEmailInUseError(null); return;
    }
    setIsCheckingEmail(true); setEmailInUseError(null);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, currentEmail.trim());
      if (methods.length > 0) {
        setEmailInUseError('This email is already in use. Please login or use a different email.');
      } else {
        setEmailInUseError(null);
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-email') { setEmailFormatError('Invalid email format for checking.'); }
      else { console.warn("Error checking email availability:", error); }
    } finally {
      setIsCheckingEmail(false);
    }
  }, [isSignUp]);

  const debouncedCheckEmailAvailability = useMemo(
    () => debounce(checkEmailAvailability, 1000),
    [checkEmailAvailability]
  );

  const isSignUpFormValid = useMemo(() => {
    if (!isSignUp) return true;
    const isEmailFormatCorrect = email.trim().toLowerCase().endsWith('@stanford.edu');
    return (
      isEmailFormatCorrect && !emailFormatError && !emailInUseError &&
      password.length >= 6 && name.trim() !== '' && major.trim() !== '' &&
      bio.trim() !== '' && userSelectedTags.length === 3
    );
  }, [email, password, name, major, bio, userSelectedTags, isSignUp, emailFormatError, emailInUseError]);

  useEffect(() => {
    if (isSignUp && email.trim()) {
      if (!email.trim().toLowerCase().endsWith('@stanford.edu')) {
        setEmailFormatError('Email must end with @stanford.edu');
        setEmailInUseError(null);
      } else {
        setEmailFormatError(null);
        debouncedCheckEmailAvailability(email);
      }
    } else {
      setEmailFormatError(null); setEmailInUseError(null);
    }
  }, [email, isSignUp, debouncedCheckEmailAvailability]);

  const handleSignUp = async () => {
    if (!isSignUpFormValid) {
      Alert.alert('Invalid Form', 'Please ensure all fields are correctly filled and email is available.');
      return;
    }
    if (emailFormatError || emailInUseError) {
        Alert.alert('Email Issue', emailFormatError || emailInUseError || "Please correct the email field.");
        return;
    }
    setOperationLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (methods.length > 0) {
        setEmailInUseError('This email is already in use. Please login or use a different email.');
        setOperationLoading(false);
        Alert.alert('Email In Use', 'This email is already registered. Please login or use a different one.');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const currentGlobalTags = await fetchAllTags();
        for (const tagName of userSelectedTags) {
          const tagExistsGlobally = currentGlobalTags.some(
            (globalTag) => globalTag.toLowerCase() === tagName.toLowerCase()
          );
          if (!tagExistsGlobally) {
            await addGlobalTag(tagName, user.uid);
          }
        }

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          name: name.trim(),
          major: major.trim(),
          bio: bio.trim(),
          tags: userSelectedTags,
          photoURL: null,
          createdAt: serverTimestamp(),
          friendsCount: 0, // Initialize friendsCount
          projectsCount: 0, // Initialize projectsCount
          thumbsCount: 0,   // Initialize thumbsCount
        });
        Alert.alert('Account Created!', 'Welcome to the Stanford Project Finder!');
        router.replace('/(tabs)/feed');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setEmailInUseError('This email is already in use. Please login or use a different email.');
        Alert.alert('Sign Up Error', 'This email address is already in use.');
      } else { Alert.alert('Sign Up Error', error.message); }
      console.error("Sign up error:", error);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password.'); return;
    }
    setOperationLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)/feed');
    } catch (error: any) {
      Alert.alert('Login Error', error.message); console.error("Login error:", error);
    } finally {
      setOperationLoading(false);
    }
  };

  if (authLoadingStatus) return <LoadingView text="Loading Auth..." />;
  if (authenticatedUser) return <LoadingView text="Redirecting..." />;

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Stanford Project Finder</Text>
          <Text style={styles.subtitle}>{isSignUp ? 'Create Account' : 'Login'}</Text>

          <TextInput
            label="Email" value={email} onChangeText={setEmail} style={styles.input}
            keyboardType="email-address" autoCapitalize="none"
            disabled={operationLoading || isCheckingEmail}
            error={isSignUp && (!!emailFormatError || !!emailInUseError)}
            right={isSignUp && isCheckingEmail ? <TextInput.Icon icon="timer-sand" /> : undefined}
          />
          {isSignUp && emailFormatError && (
            <HelperText type="error" visible={!!emailFormatError} style={styles.errorText}>
              {emailFormatError}
            </HelperText>
          )}
          {isSignUp && emailInUseError && (
            <HelperText type="error" visible={!!emailInUseError} style={styles.errorText}>
              {emailInUseError}
            </HelperText>
          )}

          <TextInput
            label="Password" value={password} onChangeText={setPassword} style={styles.input}
            secureTextEntry disabled={operationLoading}
          />
           {isSignUp && password.length > 0 && password.length < 6 && (
            <HelperText type="error" visible={true} style={styles.errorText}>
              Password must be at least 6 characters.
            </HelperText>
          )}

          {isSignUp && (
            <>
              <TextInput label="Full Name" value={name} onChangeText={setName} style={styles.input} disabled={operationLoading} />
              <TextInput label="Major" value={major} onChangeText={setMajor} style={styles.input} disabled={operationLoading} />
              <TextInput label="Bio" value={bio} onChangeText={setBio} multiline style={[styles.input, { minHeight: 80 }]} disabled={operationLoading} />

              <View style={styles.tagsHeaderContainer}>
                <Text style={[styles.label, { color: theme.colors.primary }]}>Select 3 Interests/Skills</Text>
                <Text style={[styles.labelHint, {color: theme.colors.onSurfaceVariant}]}> (Exactly three are required)</Text>
              </View>
              <TagSelector
                value={userSelectedTags}
                onChange={setUserSelectedTags}
                currentUid={auth.currentUser?.uid || "onboarding-temp"}
                disabled={operationLoading}
                availableTags={allAvailableTags}
              />
              <HelperText type="error" visible={userSelectedTags.length !== 3 && userSelectedTags.length > 0} style={styles.errorText}>
                {userSelectedTags.length}/3 selected. Please select exactly 3.
              </HelperText>
               <HelperText type="info" visible={userSelectedTags.length === 0 && isSignUp} style={styles.infoText}>
                Choose tags that best describe your project interests or skills.
              </HelperText>
            </>
          )}

          {operationLoading || (isSignUp && isCheckingEmail) ? (
            <ActivityIndicator animating={true} style={styles.submitButton} />
          ) : (
            <>
              {isSignUp ? (
                <Button
                  mode="contained" onPress={handleSignUp} style={styles.submitButton}
                  disabled={!isSignUpFormValid || operationLoading || isCheckingEmail}
                > Sign Up </Button>
              ) : (
                <Button
                  mode="contained" onPress={handleLogin} style={styles.submitButton}
                  disabled={!email || !password || operationLoading}
                > Login </Button>
              )}
              <Button
                mode="text"
                onPress={() => {
                    setIsSignUp(!isSignUp); setEmail(''); setPassword(''); setName('');
                    setMajor(''); setBio(''); setUserSelectedTags([]);
                    setEmailFormatError(null); setEmailInUseError(null);
                }}
                style={styles.toggleButton}
                disabled={operationLoading || (isSignUp && isCheckingEmail)}
              >
                {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles remain the same as the previous version
const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
     backgroundColor: '#f5f5f5',
  },
  formContainer: {
    padding: 24,
    backgroundColor: '#fff',
    marginHorizontal: Platform.OS === 'web' ? 'auto' : 16,
    maxWidth: 500,
    borderRadius: Platform.OS === 'web' ? 8 : 12,
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
    width: Platform.OS === 'web' ? '80%' : 'auto',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#6200ee',
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    marginVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tagsHeaderContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
  },
  infoText: {
    fontSize: 13,
  },
  submitButton: {
    marginTop: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleButton: {
    marginTop: 12,
  }
});
