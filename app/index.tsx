// app/index.tsx
import { Redirect } from 'expo-router';
import { useAuth } from './_layout'; // Import useAuth from the layout

export default function Index() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return null; // Or a loading spinner, splash screen, etc.
  }

  // If user is logged in, redirect to feed, otherwise to login.
  // The redirection logic in RootLayoutNav will also handle this,
  // but this provides an explicit entry point behavior.
  return <Redirect href={user ? '/(tabs)/feed' : '/login'} />;
}