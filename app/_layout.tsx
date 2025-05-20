// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useState } from 'react';
import 'react-native-reanimated';
import { onAuthStateChanged, User } from 'firebase/auth';

import { useColorScheme } from '@/hooks/useColorScheme';
import { auth } from '../firebase';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

interface AuthContextType {
  user: User | null;
  loading: boolean;
}
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => {
  return useContext(AuthContext);
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded && !authLoading) { // Hide splash only when fonts AND auth are loaded
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading]);

  useEffect(() => {
    if (authLoading || !fontsLoaded) return; // Wait for auth and fonts

    const inAuthScreen = segments[0] === 'login'; // Are we on the login screen?

    if (!user && !inAuthScreen) {
      // If no user and not on login, redirect to login
      router.replace('/login');
    } else if (user && inAuthScreen) {
      // User is authenticated and currently on the login screen.
      // LoginScreen.tsx is now responsible for navigating away after its internal logic (profile completion or direct to feed).
      // So, _layout.tsx will NOT redirect from here anymore to avoid conflicts.
      // However, if for some reason LoginScreen fails to navigate an existing user,
      // this could be a fallback, but ideally LoginScreen handles it.
      // For now, we remove the automatic redirect from login IF user is authenticated.
      // console.log("User is authenticated and on login screen. LoginScreen should handle next steps.");
    } else if (user && segments.length === 0) {
        // User is authenticated and at the root, redirect to main app area
        router.replace('/(tabs)/feed');
    }

  }, [user, authLoading, fontsLoaded, segments, router]);

  if (!fontsLoaded || authLoading) {
    return null; // Or a custom loading screen visible before splash screen hides
  }

  return (
    <PaperProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
