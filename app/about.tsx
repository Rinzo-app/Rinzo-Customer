import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>About Rinzo</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center" }}>
        <View style={styles.logo}><Ionicons name="water" size={40} color={Colors.primary} /></View>
        <Text style={styles.brand}>Rinzo</Text>
        <Text style={styles.tagline}>Premium laundry, at your doorstep</Text>
        <Text style={styles.version}>Version 1.0.0</Text>

        <View style={styles.links}>
          <Pressable style={styles.link} onPress={() => Linking.openURL("https://rinzo.app")}>
            <Ionicons name="globe-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.linkText}>rinzo.app</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => Linking.openURL("https://rinzo.app/privacy")}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => Linking.openURL("https://rinzo.app/terms")}>
            <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.linkText}>Terms of Service</Text>
          </Pressable>
        </View>

        <Text style={styles.copyright}>© {new Date().getFullYear()} Rinzo</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  logo: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.primaryMuted, justifyContent: "center", alignItems: "center", marginTop: 24, marginBottom: 12 },
  brand: { fontSize: 30, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  tagline: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 4 },
  version: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textMuted, marginTop: 12 },
  links: { alignSelf: "stretch", gap: 10, marginTop: 28 },
  link: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  linkText: { fontSize: 15, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  copyright: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 28 },
});
