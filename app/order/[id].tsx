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
  { key: "washing", label: "Washing", icon: "water" },
  { key: "ready", label: "Ready for Delivery", icon: "shirt" },
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
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Order Details</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shopCard}>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        </View>

        {isCancelled ? (
          <View style={styles.cancelledCard}>
            <Ionicons name="close-circle" size={32} color={Colors.error} />
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        ) : (
          <View style={styles.trackingCard}>
            <Text style={styles.sectionLabel}>Order Status</Text>
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepIndicator}>
                    <View style={[styles.stepDot, isCompleted && styles.stepDotActive, isCurrent && styles.stepDotCurrent]}>
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={isCompleted ? "#fff" : Colors.textMuted}
                      />
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
                    )}
                  </View>
                  <Text style={[styles.stepLabel, isCompleted && styles.stepLabelActive, isCurrent && styles.stepLabelCurrent]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.sectionLabel}>Pickup Details</Text>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.detailValue}>{order.pickupDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.detailValue}>{order.pickupSlot}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.detailValue}>Cash on Delivery</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionLabel}>Items</Text>
          <View style={styles.detailCard}>
            {items.map((item: any, i: number) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>{"\u20B9"}{item.price * item.quantity}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.itemRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>{"\u20B9"}{order.total}</Text>
            </View>
          </View>
        </View>

        {(order.status === "delivered" || order.status === "cancelled") && (
          <Pressable
            style={styles.reorderBigBtn}
            onPress={() => {
              router.push({
                pathname: "/order/new",
                params: { shopId: order.shopId, reorderItems: JSON.stringify(order.items) },
              });
            }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.reorderBigText}>Reorder</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  shopName: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  orderId: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.primary, marginTop: 4 },
  orderDate: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 2 },
  cancelledCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cancelledText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionLabel: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text, marginBottom: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepIndicator: { alignItems: "center", marginRight: 12 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotCurrent: { backgroundColor: Colors.accent },
  stepLine: { width: 2, height: 24, backgroundColor: Colors.borderLight },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLabel: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, paddingTop: 6 },
  stepLabelActive: { fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  stepLabelCurrent: { fontFamily: "NunitoSans_700Bold", color: Colors.accent },
  detailSection: { marginBottom: 16 },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  detailValue: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  itemQty: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textMuted, marginRight: 12 },
  itemPrice: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.text, minWidth: 50, textAlign: "right" },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  totalLabel: { flex: 1, fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  totalPrice: { fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  reorderBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  reorderBigText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: "#fff" },
});
