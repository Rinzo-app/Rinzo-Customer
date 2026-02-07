import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
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
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const formatPhone = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    setPhone(digits);
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      await sendOtp(fullPhone);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: "/verify", params: { phone: fullPhone } });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <LinearGradient
            colors={[Colors.primaryMuted, "transparent"]}
            style={styles.logoBg}
          />
          <View style={styles.iconContainer}>
            <Ionicons name="water" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Saaf</Text>
          <Text style={styles.subtitle}>Premium laundry, at your doorstep</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="1234567890"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={formatPhone}
              maxLength={10}
              autoFocus
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            phone.length < 10 && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSendOtp}
          disabled={phone.length < 10 || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>

        <Text style={styles.hint}>
          We'll send you a 6-digit code to verify
        </Text>

        <View style={styles.testCard}>
          <Ionicons name="flask-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.testNote}>Test: 1234567890 / OTP: 123456</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 48,
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
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  phoneRow: {
    flexDirection: "row",
    gap: 10,
  },
  countryCode: {
    height: 54,
    width: 68,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.text,
  },
  input: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.text,
    letterSpacing: 3,
  },
  button: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
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
  hint: {
    fontSize: 13,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 14,
  },
  testCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignSelf: "center",
  },
  testNote: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: 28,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
