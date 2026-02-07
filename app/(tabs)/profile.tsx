import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { customer, logout, updateName } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(customer?.name || "");
  const [saving, setSaving] = useState(false);

  const favsQuery = useQuery<any[]>({ queryKey: ["/api/favorites"] });

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateName(name.trim());
      setEditingName(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={32} color={Colors.primary} />
          </View>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              <Pressable style={styles.saveBtn} onPress={handleSaveName} disabled={saving}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => { setEditingName(false); setName(customer?.name || ""); }}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={styles.profileName}>{customer?.name || "Set your name"}</Text>
              <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
          <Text style={styles.profilePhone}>{customer?.phone}</Text>
        </View>

        <View style={styles.section}>
          <MenuItem
            icon="location-outline"
            label="Saved Addresses"
            onPress={() => router.push("/address/manage")}
          />
          <MenuItem
            icon="heart-outline"
            label={`Favorite Shops${favsQuery.data ? ` (${favsQuery.data.length})` : ""}`}
            onPress={() => {}}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => {}}
          />
          <MenuItem
            icon="information-circle-outline"
            label="About Saaf"
            onPress={() => {}}
          />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>Saaf v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={Colors.text} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  titleBar: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  title: { fontSize: 24, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E0F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { fontSize: 20, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  profilePhone: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 4 },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 20,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.errorLight,
    borderRadius: 14,
    marginBottom: 16,
  },
  logoutText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  version: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, textAlign: "center" },
});
