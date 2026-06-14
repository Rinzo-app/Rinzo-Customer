import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";
  const canSubmit =
    email.trim().length > 3 &&
    password.length >= 6 &&
    (!isSignup || name.trim().length > 0) &&
    !loading;

  const handleForgotPassword = async () => {
    const e = email.trim();
    if (e.length < 4 || !e.includes("@")) {
      setError("Enter your email above, then tap “Forgot password?”");
      return;
    }
    try {
      await resetPassword(e);
    } catch (err: any) {
      // Don't reveal whether an account exists — always confirm.
      if (err?.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
        return;
      }
    }
    Alert.alert(
      "Check your email",
      `If an account exists for ${e}, we've sent a link to reset your password. Check spam too.`,
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 40,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <LinearGradient
            colors={[Colors.primaryMuted, "transparent"]}
            style={styles.logoBg}
          />
          <View style={styles.iconContainer}>
            <Ionicons name="water" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Rinzo</Text>
          <Text style={styles.subtitle}>Premium laundry, at your doorstep</Text>
        </View>

        <View style={styles.form}>
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#FF6B81" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isSignup && (
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Colors.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>
                {isSignup ? "Create Account" : "Sign In"}
              </Text>
            )}
          </Pressable>

          {!isSignup && (
            <Pressable onPress={handleForgotPassword} disabled={loading} hitSlop={8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => { setMode(isSignup ? "signin" : "signup"); setError(""); }}
            disabled={loading}
            hitSlop={8}
          >
            <Text style={styles.switchModeText}>
              {isSignup
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
  },
  logoBg: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -30,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    fontFamily: "NunitoSans_800ExtraBold",
    color: Colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  form: {
    gap: 12,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 129, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 129, 0.25)",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: "#FF6B81",
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
    height: "100%",
  },
  button: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: Colors.border,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textInverse,
  },
  switchModeText: {
    fontSize: 14,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.primary,
    textAlign: "center",
    marginTop: 10,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 28,
  },
});
