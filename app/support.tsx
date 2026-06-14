import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, Linking, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const SUPPORT_EMAIL = "support@rinzo.app";
const SUPPORT_PHONE = "+919072868215";

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Help & Support</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={styles.lead}>We're here to help. Reach us any time:</Text>

        <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <View style={styles.iconWrap}><Ionicons name="mail-outline" size={20} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Email us</Text>
            <Text style={styles.rowSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>

        <Pressable style={styles.row} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
          <View style={styles.iconWrap}><Ionicons name="call-outline" size={20} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Call us</Text>
            <Text style={styles.rowSub}>{SUPPORT_PHONE}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>

        <Pressable style={styles.row} onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace("+", "")}`)}>
          <View style={styles.iconWrap}><Ionicons name="logo-whatsapp" size={20} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>WhatsApp</Text>
            <Text style={styles.rowSub}>Chat with us</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.noteText}>
            For a problem with a specific order, open that order and tap “Help / Raise Dispute” — it reaches us faster with the order details attached.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  lead: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primaryMuted, justifyContent: "center", alignItems: "center" },
  rowTitle: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  rowSub: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2 },
  note: { flexDirection: "row", gap: 10, backgroundColor: Colors.surfaceElevated, borderRadius: 12, padding: 14, marginTop: 6 },
  noteText: { flex: 1, fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, lineHeight: 19 },
});
