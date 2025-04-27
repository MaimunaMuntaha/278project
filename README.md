# Welcome to CS278 Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

---

## Quick Setup

```bash
# 1) Get the code
 git clone <repo‑url>
 cd 278project

# 2) Install base dependencies from package.json
 npm install

# 3) Install (or verify) the extra native libraries we use
#    – react‑native‑paper      UI widgets (Avatar, Chip, Card…)
#    – expo‑image‑picker       change profile picture
#    – expo‑auth‑session       OAuth helper (login page)
#    – expo‑web‑browser        launches SSO flow internally
#    – firebase                client SDK  (Auth, Firestore …)
 expo install react-native-paper expo-image-picker expo-auth-session expo-web-browser
 npm   install  firebase        # plain npm, not expo install

# 4) Run the project (choose your target from the CLI menu)
 npx expo start
```

Note: Make sure to run `npm run format` before check-in your code.

---

## Enable / Disable the login screen
During development you may want to skip the OAuth flow:

1. **Quick toggle** – open `app/index.tsx` and set the flag:
   ```ts
   const SHOW_LOGIN = false; // true = ask for login / false = skip
   ```
2. **Permanent removal** – comment out the `<Stack.Screen name="login" />` line in `app/_layout.tsx` (root stack).

When the login screen is inactive the app redirects straight to the main feed. When it is active, click "Complete Profile" will also bring you to the main feed.

---

## Common scripts

```bash
npm run reset-project   # wipe /app and copy the starter again
npm run lint            # run ESLint + Expo config (read .eslintrc.js)
npm run lint:fix        # same as above, but auto‑fix problems
npm test                # run Jest (jest‑expo preset)
```
