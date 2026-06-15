import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { fetchPlans, fetchMyMembership, purchaseMembership, type Plan } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import Colors from "@/constants/colors";

function benefitLines(p: Plan): string[] {
  const out: string[] = [];
  if (p.freeDelivery) out.push("Free delivery on every order");
  if (p.discountBps > 0) out.push(`${p.discountBps / 100}% off all items`);
  out.push(`Valid for ${p.durationDays} days`);
  return out;
}

export default function MembershipScreen() {
  const insets = useSafeAreaInsets();
  const plansQuery = useQuery({ queryKey: ["membership-plans"], queryFn: fetchPlans });
  const meQuery = useQuery({ queryKey: ["my-membership"], queryFn: fetchMyMembership });

  const buyMutation = useMutation({
    mutationFn: (planId: string) => purchaseMembership(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-membership"] });
      Alert.alert("You're a member! 🎉", "Your benefits are now active.");
    },
    onError: (e: any) => {
      Alert.alert(
        "Can't purchase yet",
        e?.message || "Online membership purchase isn't available yet — please ask support to activate your plan.",
      );
    },
  });

  const me = meQuery.data;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Rinzo Plus</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {meQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        ) : me ? (
          <View style={styles.activeCard}>
            <Ionicons name="star" size={22} color="#FFB020" />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>{me.planName} — active</Text>
              <Text style={styles.activeSub}>
                {me.freeDelivery ? "Free delivery" : ""}
                {me.discountBps > 0 ? `${me.freeDelivery ? " · " : ""}${me.discountBps / 100}% off items` : ""}
                {" · expires "}
                {new Date(me.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.intro}>Save on every order with a Rinzo Plus membership.</Text>
        )}

        <Text style={styles.sectionTitle}>Plans</Text>
        {plansQuery.isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (plansQuery.data ?? []).length === 0 ? (
          <Text style={styles.empty}>No plans available right now.</Text>
        ) : (
          (plansQuery.data ?? []).map((p) => (
            <View key={p.id} style={styles.planCard}>
              <View style={styles.planHead}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>{formatMoney(p.price)}</Text>
              </View>
              {benefitLines(p).map((b) => (
                <View key={b} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
              <Pressable
                style={({ pressed }) => [styles.buyBtn, pressed && { opacity: 0.85 }]}
                onPress={() => buyMutation.mutate(p.id)}
                disabled={buyMutation.isPending}
              >
                {buyMutation.isPending ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <Text style={styles.buyText}>Get {p.name}</Text>
                )}
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.note}>
          To activate a plan, complete payment or ask Rinzo support — your benefits apply automatically at checkout.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, paddingTop: 8,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  content: { padding: 20, paddingBottom: 60 },
  intro: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginBottom: 16 },
  activeCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.primaryMuted,
    borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: Colors.primary,
  },
  activeTitle: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  activeSub: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text, marginBottom: 12 },
  empty: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  planCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  planName: { fontSize: 17, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  planPrice: { fontSize: 17, fontFamily: "NunitoSans_800ExtraBold", color: Colors.primary },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  benefitText: { fontSize: 13.5, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  buyBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 8,
  },
  buyText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  note: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 8, lineHeight: 17 },
});
