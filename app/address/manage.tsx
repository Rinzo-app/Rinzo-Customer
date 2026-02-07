import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiRequest, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import type { Address } from "@shared/schema";

const LABEL_OPTIONS = ["Home", "Work", "Other"];

export default function AddressManageScreen() {
  const insets = useSafeAreaInsets();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Home");
  const [addressLine, setAddressLine] = useState("");
  const [lat, setLat] = useState("28.6139");
  const [lng, setLng] = useState("77.2090");

  const addressesQuery = useQuery<Address[]>({ queryKey: ["/api/addresses"] });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/addresses", {
        label,
        addressLine: addressLine.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        isDefault: !addressesQuery.data || addressesQuery.data.length === 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setShowForm(false);
      setAddressLine("");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => Alert.alert("Error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/addresses"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/addresses/${id}/default`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/addresses"] }),
  });

  const handleDelete = (id: string) => {
    Alert.alert("Delete Address", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Saved Addresses</Text>
        <Pressable style={styles.topBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {addressesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !addressesQuery.data || addressesQuery.data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptyText}>Add an address for quick ordering</Text>
          <Pressable style={styles.addBigBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.addBigText}>Add Address</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={addressesQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.addrCard, item.isDefault && styles.addrCardDefault]}>
              <Pressable
                style={styles.addrMain}
                onPress={() => setDefaultMutation.mutate(item.id)}
              >
                <Ionicons
                  name={item.isDefault ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={item.isDefault ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.addrInfo}>
                  <View style={styles.addrLabelRow}>
                    <Text style={styles.addrLabel}>{item.label}</Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addrLine} numberOfLines={2}>{item.addressLine}</Text>
                </View>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Address</Text>
              <Pressable onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.formLabel}>Label</Text>
            <View style={styles.labelsRow}>
              {LABEL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={[styles.labelChip, label === opt && styles.labelChipActive]}
                  onPress={() => setLabel(opt)}
                >
                  <Text style={[styles.labelChipText, label === opt && styles.labelChipTextActive]}>{opt}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Full Address</Text>
            <TextInput
              style={styles.formInput}
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="Enter your full address"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Coordinates (auto-detected)</Text>
            <View style={styles.coordRow}>
              <TextInput
                style={[styles.formInput, styles.coordInput]}
                value={lat}
                onChangeText={setLat}
                placeholder="Latitude"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.formInput, styles.coordInput]}
                value={lng}
                onChangeText={setLng}
                placeholder="Longitude"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            <Pressable
              style={[styles.saveAddrBtn, (!addressLine.trim()) && styles.saveBtnDisabled]}
              onPress={() => addMutation.mutate()}
              disabled={!addressLine.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveAddrText}>Save Address</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  addBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  addBigText: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: "#fff" },
  listContent: { padding: 20, paddingBottom: 100 },
  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  addrCardDefault: { borderColor: Colors.primary },
  addrMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  addrInfo: { flex: 1 },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addrLabel: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  defaultBadge: { backgroundColor: "#E0F7FA", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  defaultText: { fontSize: 10, fontFamily: "NunitoSans_700Bold", color: Colors.primary },
  addrLine: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  formLabel: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
  labelsRow: { flexDirection: "row", gap: 8 },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
  },
  labelChipActive: { backgroundColor: Colors.primary },
  labelChipText: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  labelChipTextActive: { color: "#fff" },
  formInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 14,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.text,
    textAlignVertical: "top",
  },
  coordRow: { flexDirection: "row", gap: 10 },
  coordInput: { flex: 1 },
  saveAddrBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveBtnDisabled: { backgroundColor: Colors.textMuted },
  saveAddrText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: "#fff" },
});
