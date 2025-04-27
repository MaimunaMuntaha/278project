import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  return (
    <PaperProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/*      Only three routes in the root stack                        */}
        <Stack screenOptions={{ headerShown: false }}>
          {/* 👉  COMMENT THIS LINE when you don’t want to deal with login */}
          <Stack.Screen name="login" />

          {/* tabs live inside (tabs)/_layout.tsx                        */}
          <Stack.Screen name="(tabs)" />

          {/* 404 fallback                                              */}
          <Stack.Screen name="+not-found" options={{ headerShown: true }} />
        </Stack>

        <StatusBar style="auto" />
      </ThemeProvider>
    </PaperProvider>
  );
}
