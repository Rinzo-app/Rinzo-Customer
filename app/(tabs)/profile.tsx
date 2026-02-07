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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={30} color={Colors.primary} />
            </View>
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
                <Ionicons name="checkmark" size={18} color={Colors.textInverse} />
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => { setEditingName(false); setName(customer?.name || ""); }}>
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={styles.profileName}>{customer?.name || "Set your name"}</Text>
              <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
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
            label={`Favorites${favsQuery.data ? ` (${favsQuery.data.length})` : ""}`}
            onPress={() => {}}
            showDivider
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => {}}
            showDivider
          />
          <MenuItem
            icon="information-circle-outline"
            label="About Saaf"
            onPress={() => {}}
            isLast
          />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>Saaf v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, onPress, showDivider, isLast }: {
  icon: string; label: string; onPress: () => void; showDivider?: boolean; isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: Colors.surfaceElevated },
        !isLast && styles.menuDivider,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon as any} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  titleBar: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12 },
  title: { fontSize: 26, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: Colors.borderAccent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  profileName: { fontSize: 20, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  profilePhone: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 4 },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
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
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
    marginBottom: 20,
  },
  logoutText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  version: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, textAlign: "center" },
});
