import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { fetch } from "expo/fetch";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import {
  isFirebaseConfigured,
  firebaseReady,
  getFirebaseAuth,
} from "./firebase";
import { queryClient } from "./query-client";
import { BACKEND_URL } from "./config";
import { request } from "./http-client";
import { registerForPushNotifications } from "./push-notifications";

// ── Public interface (unchanged from previous consumers) ─
interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export type UserStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  customer: CustomerInfo | null;
  token: string | null;
  userStatus: UserStatus | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Whether the signed-in user's email has been verified. */
  emailVerified: boolean;
  /** (Re)send the Firebase verification email to the current user. */
  resendVerification: () => Promise<void>;
  /** Reload the Firebase user so emailVerified reflects a just-clicked link. */
  reloadEmailStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);

  const appState = useRef(AppState.currentState);
  // True while signUp() runs. createUserWithEmailAndPassword fires
  // onAuthStateChanged immediately, which would fetch /api/auth/me
  // before the backend row exists (→ 401 → destructive sign-out).
  const isRegistering = useRef(false);

  // ── Fetch user status from backend ─────────────────────
  const fetchUserStatus = useCallback(async () => {
    try {
      const data = await request<{ status?: string; role?: string }>("GET", "/api/auth/me");

      // One account = one role. This app is for customers only —
      // shop owners and riders have their own apps.
      if (data.role && data.role !== "CUSTOMER") {
        const appName = data.role === "SHOP_OWNER" ? "Rinzo Owner app" : "Rinzo Rider app";
        Alert.alert(
          "Wrong app for this account",
          `This account is registered as a ${data.role.toLowerCase().replace("_", " ")} — please use the ${appName}.`,
        );
        const auth = getFirebaseAuth();
        if (auth) await signOut(auth).catch(() => {});
        setFirebaseUser(null);
        setToken(null);
        setUserStatus(null);
        return null;
      }

      const status = (data.status as UserStatus) || "ACTIVE";
      setUserStatus(status);
      return status;
    } catch (err) {
      console.warn("Failed to fetch user status:", err);
      // Default to ACTIVE on error so we don't block the user
      // when the endpoint is unavailable
      return null;
    }
  }, []);

  /** Public refresh — re-fetches status from backend */
  const refreshProfile = useCallback(async () => {
    await fetchUserStatus();
  }, [fetchUserStatus]);

  // ── Bootstrap: listen to Firebase auth state ───────────
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    firebaseReady
      .then(async () => {
        const auth = getFirebaseAuth();
        if (!auth) {
          setIsLoading(false);
          return;
        }
        unsubscribe = onAuthStateChanged(auth, async (user: any) => {
          // During sign-up the Firebase account exists before the backend
          // row does — becoming "authenticated" here lets screens mount
          // and fire queries into that 401 window. signUp() owns all
          // state updates until it completes.
          if (user && isRegistering.current) {
            setIsLoading(false);
            return;
          }

          setFirebaseUser(user);
          if (user) {
            const idToken = await user.getIdToken();
            setToken(idToken);
            await fetchUserStatus();
            // Register this device for push notifications (never throws)
            registerForPushNotifications();
          } else {
            setToken(null);
            setUserStatus(null);
          }
          setIsLoading(false);
        });
      })
      .catch(() => {
        setIsLoading(false);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserStatus]);

  // ── AppState listener: refetch status on foreground ────
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active" &&
        firebaseUser
      ) {
        fetchUserStatus();
      }
      appState.current = nextState;
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [firebaseUser, fetchUserStatus]);

  // ── Register with the unified backend (409 = exists) ───
  async function registerWithBackend(
    idToken: string,
    payload: { name: string; email: string },
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/auth/register/customer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok || res.status === 409) return true;
      console.warn("Backend registration:", res.status);
      return false;
    } catch (err) {
      console.warn("Backend registration failed:", err);
      return false;
    }
  }

  // ── Email / password sign-in ────────────────────────────
  async function login(email: string, password: string) {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged updates firebaseUser, token, and status
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        throw new Error("Invalid email or password");
      } else if (code === "auth/user-not-found") {
        throw new Error("No account found with this email");
      } else if (code === "auth/too-many-requests") {
        throw new Error("Too many attempts. Please try again later");
      } else if (code === "auth/invalid-email") {
        throw new Error("Please enter a valid email");
      } else if (code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your connection");
      }
      throw new Error("Sign in failed. Please try again");
    }
  }

  // ── Email / password sign-up ────────────────────────────
  async function signUp(name: string, email: string, password: string) {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");

    isRegistering.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name }).catch(() => {});
      // Best-effort verification email; never block signup if it fails.
      sendEmailVerification(cred.user).catch(() => {});

      const idToken = await cred.user.getIdToken();
      const registered = await registerWithBackend(idToken, { name, email });
      if (!registered) {
        // Roll back the orphaned Firebase account so the user can retry
        await cred.user.delete().catch(() => {});
        throw new Error("REGISTRATION_FAILED");
      }
      setFirebaseUser({ ...cred.user });
      setToken(idToken);
      // Backend row now exists — safe to fetch status.
      await fetchUserStatus();
      registerForPushNotifications();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        throw new Error("An account with this email already exists — sign in instead");
      } else if (code === "auth/weak-password") {
        throw new Error("Password is too weak — use at least 6 characters");
      } else if (code === "auth/invalid-email") {
        throw new Error("Please enter a valid email");
      } else if (code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your connection");
      } else if (err?.message === "REGISTRATION_FAILED") {
        throw new Error("Could not create your account. Please try again");
      }
      throw new Error("Sign up failed. Please try again");
    } finally {
      isRegistering.current = false;
    }
  }

  // ── Logout ─────────────────────────────────────────────
  async function logout() {
    try {
      await firebaseReady;
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
    setFirebaseUser(null);
    setToken(null);
    setUserStatus(null);
    queryClient.clear();
  }

  // ── Email verification ─────────────────────────────────
  async function resendVerification() {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) throw new Error("Not authenticated");
    await sendEmailVerification(auth.currentUser);
  }

  async function reloadEmailStatus() {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return;
    await auth.currentUser.reload();
    // Force a fresh ID token so the backend sees email_verified=true
    // (the cached token keeps the old claim for up to an hour otherwise).
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true).catch(() => {});
    }
    // Re-render with the refreshed emailVerified flag.
    setFirebaseUser({ ...auth.currentUser });
  }

  // ── Update display name ────────────────────────────────
  async function updateName(name: string) {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) throw new Error("Not authenticated");

    await updateProfile(auth.currentUser, { displayName: name });

    // Force re-render with updated displayName
    setFirebaseUser({ ...auth.currentUser });
  }

  // ── Derive customer-like object from Firebase user ─────
  const customer: CustomerInfo | null = firebaseUser
    ? {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || "",
        phone: firebaseUser.phoneNumber || "",
        email: firebaseUser.email || null,
      }
    : null;

  const value = useMemo(
    () => ({
      isAuthenticated: !!firebaseUser,
      isLoading,
      customer,
      token,
      userStatus,
      login,
      signUp,
      logout,
      updateName,
      refreshProfile,
      emailVerified: !!firebaseUser?.emailVerified,
      resendVerification,
      reloadEmailStatus,
    }),
    [isLoading, firebaseUser, token, userStatus, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
