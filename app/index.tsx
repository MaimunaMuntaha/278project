import { Redirect } from 'expo-router';

/** Toggle this flag instead of commenting code everywhere. */
const SHOW_LOGIN = true; // ← set to false to bypass login

export default function Index() {
  return <Redirect href={SHOW_LOGIN ? '/login' : '/feed'} />;
}
