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
import { Platform, View, AppState, AppStateStatus } from "react-native";
import { fetch } from "expo/fetch";
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  RecaptchaVerifier,
} from "firebase/auth";
import {
  isFirebaseConfigured,
  firebaseReady,
  getFirebaseAuth,
} from "./firebase";
import { queryClient } from "./query-client";
import { BACKEND_URL } from "./config";
import { request } from "./http-client";

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
  login: (phone: string, otp: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);

  // Stores the ConfirmationResult between sendOtp → login calls
  const confirmationResultRef = useRef<any>(null);
  const recaptchaVerifierRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  // ── Fetch user status from backend ─────────────────────
  const fetchUserStatus = useCallback(async () => {
    try {
      const data = await request<{ status?: string }>("GET", "/api/auth/me");
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
          setFirebaseUser(user);
          if (user) {
            const idToken = await user.getIdToken();
            setToken(idToken);
            // Fetch user status from backend after auth
            await fetchUserStatus();
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

  // ── Send OTP via Firebase Phone Auth ───────────────────
  async function sendOtp(phone: string) {
    await firebaseReady;
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase is not configured");

    if (Platform.OS === "web") {
      // Invisible reCAPTCHA — attaches to the container rendered below
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          { size: "invisible" },
        );
      }
      confirmationResultRef.current = await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaVerifierRef.current,
      );
    } else {
      // Native builds require @react-native-firebase/auth for SMS verification.
      // For development, use Expo Web (npx expo start --web).
      throw new Error(
        "Firebase Phone Auth on native requires @react-native-firebase/auth. " +
          "Use Expo Web for development or install the native module.",
      );
    }
  }

  // ── Verify OTP & register with unified backend ─────────
  async function login(phone: string, otp: string) {
    if (!confirmationResultRef.current) {
      throw new Error("No pending OTP verification. Call sendOtp first.");
    }

    const result = await confirmationResultRef.current.confirm(otp);
    const user = result.user;
    const idToken = await user.getIdToken();

    // Auto-register with the unified backend on first login.
    // 409 (Conflict) means the user already exists — safe to ignore.
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/auth/register/customer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: user.displayName || "",
            phone: user.phoneNumber || phone,
          }),
        },
      );
      if (!res.ok && res.status !== 409) {
        console.warn("Backend registration:", res.status);
      }
    } catch (err) {
      // Non-fatal — the user may already be registered
      console.warn("Backend registration failed (non-fatal):", err);
    }

    // onAuthStateChanged will update firebaseUser & token state
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
    confirmationResultRef.current = null;
    recaptchaVerifierRef.current = null;
    setFirebaseUser(null);
    setToken(null);
    setUserStatus(null);
    queryClient.clear();
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
      sendOtp,
      logout,
      updateName,
      refreshProfile,
    }),
    [isLoading, firebaseUser, token, userStatus, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {/* Invisible reCAPTCHA container for Firebase Phone Auth (web) */}
      {Platform.OS === "web" && (
        <View
          nativeID="recaptcha-container"
          style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
