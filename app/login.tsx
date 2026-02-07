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
        <View style={styles.iconContainer}>
          <Ionicons name="water" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Saaf</Text>
        <Text style={styles.subtitle}>Clean clothes, delivered fresh</Text>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Enter your phone number</Text>
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
          <Text style={styles.hint}>We'll send you a 6-digit verification code</Text>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get OTP</Text>
          )}
        </Pressable>

        <Text style={styles.testNote}>
          Test: 1234567890 / OTP: 123456
        </Text>
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
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#E0F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontFamily: "NunitoSans_800ExtraBold",
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textSecondary,
    marginBottom: 40,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: "row",
    gap: 10,
  },
  countryCode: {
    height: 52,
    width: 64,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
  },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
    letterSpacing: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    marginTop: 8,
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
    color: "#fff",
  },
  testNote: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
