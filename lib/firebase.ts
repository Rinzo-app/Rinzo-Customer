import { Platform } from "react-native";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import type { Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// getReactNativePersistence is exported at runtime via Metro's
// react-native-specific entry point but missing from the default
// TypeScript declarations.  This augmentation bridges the gap.
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: unknown): Persistence;
}

// ── Required Firebase env vars (must be non-empty for auth to work) ──
const REQUIRED_VARS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

function getEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

// Log missing vars at startup so EAS build failures are diagnosable
const missingRequired = REQUIRED_VARS.filter((k) => !getEnv(k));
if (missingRequired.length > 0) {
  console.error(
    `[Firebase] Missing required environment variables: ${missingRequired.join(', ')}. ` +
    'Firebase auth will be disabled. Set these in eas.json env or EAS Secrets.',
  );
}

const firebaseConfig = {
  apiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
};

/**
 * Firebase is considered configured when ALL required fields
 * (apiKey, authDomain, projectId) are present and non-empty.
 */
export const isFirebaseConfigured = missingRequired.length === 0;

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firebaseAuth: ReturnType<typeof getAuth> | null = null;

function initFirebase() {
  if (!isFirebaseConfigured) return;

  firebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  if (Platform.OS === "web") {
    firebaseAuth = getAuth(firebaseApp);
  } else {
    try {
      // AsyncStorage, not SecureStore: Firebase persistence keys contain
      // ':' (invalid for SecureStore) and session blobs exceed its 2 KB
      // value limit. This matches the standard Firebase RN setup.
      firebaseAuth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Already initialised — grab the existing instance
      firebaseAuth = getAuth(firebaseApp);
    }
  }
}

// Execute synchronously at module load.
// Other modules `await firebaseReady` — awaiting void is a no-op.
const firebaseReady = Promise.resolve(initFirebase());

export function getFirebaseAuth() {
  return firebaseAuth;
}

export { firebaseReady };
