import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";

const STATUS_STEPS = [
  { key: "placed", label: "Order Placed", icon: "checkmark-circle" },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-done-circle" },
  { key: "picked_up", label: "Picked Up", icon: "bicycle" },
  { key: "washing", label: "In Progress", icon: "water" },
  { key: "ready", label: "Ready", icon: "shirt" },
  { key: "delivered", label: "Delivered", icon: "home" },
];

function getStepIndex(status: string): number {
  if (status === "cancelled") return -1;
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const orderQuery = useQuery<any>({ queryKey: [`/api/orders/${id}`] });
  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Order not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Order Details</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shopCard}>
          <View>
            <Text style={styles.shopName}>{order.shopName}</Text>
            <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </Text>
        </View>

        {isCancelled ? (
          <View style={styles.cancelledCard}>
            <Ionicons name="close-circle" size={28} color={Colors.error} />
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        ) : (
          <View style={styles.trackingCard}>
            <Text style={styles.trackLabel}>Tracking</Text>
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepIndicator}>
                    <View style={[
                      styles.stepDot,
                      isCompleted && styles.stepDotActive,
                      isCurrent && styles.stepDotCurrent,
                    ]}>
                      <Ionicons
                        name={step.icon as any}
                        size={14}
                        color={isCompleted ? Colors.textInverse : Colors.textMuted}
                      />
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelActive,
                    isCurrent && styles.stepLabelCurrent,
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.detailHeading}>Pickup</Text>
          <View style={styles.detailCard}>
            <DetailRow icon="calendar-outline" value={order.pickupDate} />
            <DetailRow icon="time-outline" value={order.pickupSlot} />
            <DetailRow icon="cash-outline" value="Cash on Delivery" />
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailHeading}>Items</Text>
          <View style={styles.detailCard}>
            {items.map((item: any, i: number) => (
              <View key={i} style={[styles.itemRow, i < items.length - 1 && styles.itemBorder]}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>{"\u20B9"}{item.price * item.quantity}</Text>
              </View>
            ))}
            <View style={styles.totalDivider} />
            <View style={styles.itemRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>{"\u20B9"}{order.total}</Text>
            </View>
          </View>
        </View>

        {(order.status === "delivered" || order.status === "cancelled") && (
          <Pressable
            style={({ pressed }) => [styles.reorderBigBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              router.push({
                pathname: "/order/new",
                params: { shopId: order.shopId, reorderItems: JSON.stringify(order.items) },
              });
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.textInverse} />
            <Text style={styles.reorderBigText}>Reorder</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon as any} size={15} color={Colors.textSecondary} />
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  errorText: { fontSize: 16, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  backLink: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.primary, marginTop: 8 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shopName: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  orderId: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.primary, marginTop: 3 },
  orderDate: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  cancelledCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
  },
  cancelledText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackLabel: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepIndicator: { alignItems: "center", marginRight: 14 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotCurrent: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepLine: { width: 2, height: 22, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLabel: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, paddingTop: 5 },
  stepLabelActive: { fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  stepLabelCurrent: { fontFamily: "NunitoSans_700Bold", color: Colors.accent },
  detailSection: { marginBottom: 16 },
  detailHeading: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  detailValue: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemName: { flex: 1, fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  itemQty: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textMuted, marginRight: 14 },
  itemPrice: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text, minWidth: 50, textAlign: "right" },
  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  totalLabel: { flex: 1, fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  totalPrice: { fontSize: 20, fontFamily: "NunitoSans_800ExtraBold", color: Colors.accent },
  reorderBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  reorderBigText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
});
