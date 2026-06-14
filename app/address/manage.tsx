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
import * as Location from "expo-location";
import { apiRequest, queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import type { Address } from "@/lib/types";

const LABEL_OPTIONS = ["Home", "Work", "Other"];

export default function AddressManageScreen() {
  const insets = useSafeAreaInsets();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Home");
  const [addressLine, setAddressLine] = useState("");
  // Real GPS only — never fabricate coordinates. Delivery fees and
  // rider assignment depend on them being honest (or absent).
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const addressesQuery = useQuery<Address[]>({ queryKey: ["/api/addresses"] });

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location required",
          "Allow location access so riders can find this address and we can calculate the delivery fee. You can enable it in Settings.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Location failed", "Could not get your location. Move to an open area and try again — a location is required to save the address.");
    } finally {
      setLocating(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error("Capture your location before saving.");
      await apiRequest("POST", "/api/addresses", {
        label,
        addressLine: addressLine.trim(),
        lat: coords.lat,
        lng: coords.lng,
        isDefault: !addressesQuery.data || addressesQuery.data.length === 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setShowForm(false);
      setAddressLine("");
      setCoords(null);
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
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Addresses</Text>
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
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No saved addresses</Text>
          <Text style={styles.emptyText}>Add one for quick ordering</Text>
          <Pressable style={styles.addBigBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={16} color={Colors.textInverse} />
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
                  size={18}
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
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Address</Text>
              <Pressable onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
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

            <Text style={styles.formLabel}>Location (required)</Text>
            <Pressable
              style={[styles.locateBtn, coords && styles.locateBtnDone]}
              onPress={captureLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons
                  name={coords ? "checkmark-circle" : "locate"}
                  size={18}
                  color={coords ? "#22C55E" : Colors.primary}
                />
              )}
              <Text style={[styles.locateText, coords && styles.locateTextDone]}>
                {coords
                  ? `Location captured (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                  : "Use my current location"}
              </Text>
            </Pressable>
            {!coords && (
              <Text style={styles.locateRequiredHint}>
                Stand at the address and capture your location so riders can find you.
              </Text>
            )}

            <Pressable
              style={[styles.saveAddrBtn, (!addressLine.trim() || !coords) && styles.saveBtnDisabled]}
              onPress={() => addMutation.mutate()}
              disabled={!addressLine.trim() || !coords || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color={Colors.textInverse} />
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
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 40 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  addBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  addBigText: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  listContent: { padding: 20, paddingBottom: 100 },
  addrCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addrCardDefault: { borderColor: Colors.primary },
  addrMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  addrInfo: { flex: 1 },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addrLabel: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  defaultBadge: { backgroundColor: Colors.primaryMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  defaultText: { fontSize: 10, fontFamily: "NunitoSans_700Bold", color: Colors.primary },
  addrLine: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 3 },
  deleteBtn: { padding: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  formLabel: {
    fontSize: 12,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  labelsRow: { flexDirection: "row", gap: 8 },
  labelChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  labelChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  labelChipText: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  labelChipTextActive: { color: Colors.textInverse },
  formInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 14,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.text,
    textAlignVertical: "top",
    minHeight: 80,
  },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locateBtnDone: { borderColor: "#22C55E" },
  locateText: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.primary, flex: 1 },
  locateTextDone: { color: "#22C55E" },
  locateRequiredHint: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 6 },
  saveAddrBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveAddrText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
});
