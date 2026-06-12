import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { queryClient } from "@/lib/query-client";
import { placeOrder, quoteOrder } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/lib/cart-context";
import Colors from "@/constants/colors";
import type { Address } from "@/lib/types";

const PICKUP_SLOTS = [
  "8 - 10 AM",
  "10 AM - 12 PM",
  "12 - 2 PM",
  "2 - 4 PM",
  "4 - 6 PM",
  "6 - 8 PM",
];

function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d.toISOString().split("T")[0],
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      num: d.getDate().toString(),
    });
  }
  return days;
}

export default function NewOrderScreen() {
  const insets = useSafeAreaInsets();
  const { shopId, items: itemsParam, reorderItems } = useLocalSearchParams<{
    shopId: string; items?: string; reorderItems?: string;
  }>();
  const { clearCart } = useCart();
  // One key per checkout screen — double-taps and network retries
  // replay the same order on the backend instead of duplicating it.
  const idempotencyKeyRef = useRef(Crypto.randomUUID());

  const parsedItems = useMemo(() => {
    try {
      return JSON.parse(reorderItems || itemsParam || "[]");
    } catch {
      return [];
    }
  }, [itemsParam, reorderItems]);

  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const days = useMemo(() => getNextDays(7), []);

  const addressesQuery = useQuery<Address[]>({ queryKey: ["/api/addresses"] });

  const defaultAddr = addressesQuery.data?.find((a) => a.isDefault);
  const activeAddressId = selectedAddressId || defaultAddr?.id;

  const itemsTotal = parsedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
  const itemCount = parsedItems.reduce((s: number, i: any) => s + i.quantity, 0);

  // ── Full price preview (items + delivery + platform fee) ──
  // Re-quotes when the pickup address changes (delivery fee is
  // distance-based). Falls back to the items total while loading.
  const quoteAddr = addressesQuery.data?.find((a) => a.id === activeAddressId);
  const quoteQuery = useQuery({
    queryKey: ["order-quote", shopId, itemsParam ?? reorderItems, quoteAddr?.id],
    queryFn: () =>
      quoteOrder({
        shopId: shopId!,
        items: parsedItems.map((i: any) => ({ serviceId: i.serviceId, quantity: i.quantity })),
        ...(quoteAddr?.lat != null && quoteAddr?.lng != null
          ? { pickupLat: quoteAddr.lat, pickupLng: quoteAddr.lng }
          : {}),
      }),
    enabled: !!shopId && parsedItems.length > 0,
  });
  const quote = quoteQuery.data;
  const grandTotal = quote?.total ?? itemsTotal;

  const orderMutation = useMutation({
    mutationFn: async () => {
      const selectedAddr = addressesQuery.data?.find((a) => a.id === activeAddressId);
      const addressLine = selectedAddr?.addressLine || "Pickup address";
      // Send the address's GPS coordinates — they drive the delivery
      // fee and rider assignment. Addresses saved without GPS simply
      // omit them (backend charges the fallback fee).
      const hasCoords = selectedAddr?.lat != null && selectedAddr?.lng != null;
      return placeOrder({
        shopId,
        items: parsedItems.map((i: any) => ({ serviceId: i.serviceId, quantity: i.quantity })),
        pickupAddress: addressLine,
        deliveryAddress: addressLine,
        pickupDate: days[selectedDate].date,
        pickupSlot: selectedSlot || undefined,
        idempotencyKey: idempotencyKeyRef.current,
        ...(hasCoords ? { pickupLat: selectedAddr!.lat, pickupLng: selectedAddr!.lng } : {}),
      });
    },
    onSuccess: (data) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      router.replace({ pathname: "/order/[id]", params: { id: data.id } });
    },
    onError: (err: Error) => {
      Alert.alert("Order Failed", err.message);
    },
  });

  const handlePlaceOrder = () => {
    if (orderMutation.isPending) return; // guard double-taps client-side too
    if (!selectedSlot) {
      Alert.alert("Select Time", "Please select a pickup time slot");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    orderMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Schedule Pickup</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pickup Address</Text>
          {addressesQuery.isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : !addressesQuery.data || addressesQuery.data.length === 0 ? (
            <Pressable style={styles.addAddressBtn} onPress={() => router.push("/address/manage")}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.addAddressText}>Add an Address</Text>
            </Pressable>
          ) : (
            <View style={styles.addressList}>
              {addressesQuery.data.map((addr) => (
                <Pressable
                  key={addr.id}
                  style={[styles.addressCard, activeAddressId === addr.id && styles.addressSelected]}
                  onPress={() => setSelectedAddressId(addr.id)}
                >
                  <Ionicons
                    name={activeAddressId === addr.id ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={activeAddressId === addr.id ? Colors.primary : Colors.textMuted}
                  />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{addr.label}</Text>
                    <Text style={styles.addressLine} numberOfLines={1}>{addr.addressLine}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pick a Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
            {days.map((d, i) => (
              <Pressable
                key={d.date}
                style={[styles.dayChip, selectedDate === i && styles.dayChipActive]}
                onPress={() => setSelectedDate(i)}
              >
                <Text style={[styles.dayLabel, selectedDate === i && styles.dayLabelActive]}>{d.day}</Text>
                <Text style={[styles.dayNum, selectedDate === i && styles.dayNumActive]}>{d.num}</Text>
                {i === 0 && <Text style={[styles.dayToday, selectedDate === i && styles.dayTodayActive]}>Today</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pick a Time</Text>
          <View style={styles.slotsGrid}>
            {PICKUP_SLOTS.map((slot) => (
              <Pressable
                key={slot}
                style={[styles.slotChip, selectedSlot === slot && styles.slotChipActive]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  setSelectedSlot(slot);
                }}
              >
                <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>{slot}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <View style={styles.summaryCard}>
            {parsedItems.map((item: any, i: number) => (
              <View key={i} style={styles.summaryRow}>
                <Text style={styles.summaryName}>{item.name}</Text>
                <Text style={styles.summaryQty}>x{item.quantity}</Text>
                <Text style={styles.summaryPrice}>{formatMoney(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.feeLabel}>Items ({itemCount})</Text>
              <Text style={styles.feeValue}>{formatMoney(quote?.itemsTotal ?? itemsTotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.feeLabel}>Pickup & delivery</Text>
              <Text style={styles.feeValue}>
                {quote ? formatMoney(quote.deliveryFee) : "\u2026"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.feeLabel}>Platform fee</Text>
              <Text style={styles.feeValue}>
                {quote ? formatMoney(quote.platformFee) : "\u2026"}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total to pay</Text>
              <Text style={styles.totalPrice}>{formatMoney(grandTotal)}</Text>
            </View>
            <Text style={styles.weighNote}>
              Final price may adjust after your laundry is weighed at the shop \u2014
              you'll be asked to approve any increase over 20%.
            </Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <View style={styles.paymentLeft}>
            <Ionicons name="cash-outline" size={18} color={Colors.success} />
            <Text style={styles.paymentText}>Cash on Delivery</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
        <View style={styles.bottomInfo}>
          <Text style={styles.bottomLabel}>Total to pay</Text>
          <Text style={styles.bottomTotal}>{formatMoney(grandTotal)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.orderBtn, pressed && { opacity: 0.85 }, orderMutation.isPending && { opacity: 0.6 }]}
          onPress={handlePlaceOrder}
          disabled={orderMutation.isPending}
        >
          {orderMutation.isPending ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Text style={styles.orderBtnText}>Place Order</Text>
              <Ionicons name="checkmark-circle" size={16} color={Colors.textInverse} />
            </>
          )}
        </Pressable>
      </View>
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    borderStyle: "dashed",
    backgroundColor: Colors.primaryMuted,
  },
  addAddressText: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.primary },
  addressList: { gap: 8 },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  addressInfo: { flex: 1 },
  addressLabel: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  addressLine: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2 },
  daysRow: { gap: 8 },
  dayChip: {
    width: 58,
    height: 74,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayLabel: { fontSize: 11, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  dayLabelActive: { color: Colors.textInverse },
  dayNum: { fontSize: 20, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text, marginVertical: 1 },
  dayNumActive: { color: Colors.textInverse },
  dayToday: { fontSize: 9, fontFamily: "NunitoSans_700Bold", color: Colors.primary },
  dayTodayActive: { color: Colors.textInverse },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { fontSize: 12, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  slotTextActive: { color: Colors.textInverse },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  summaryName: { flex: 1, fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  summaryQty: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textMuted, marginRight: 12 },
  summaryPrice: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.text, minWidth: 50, textAlign: "right" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  totalLabel: { flex: 1, fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  feeLabel: { flex: 1, fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  feeValue: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  weighNote: {
    fontSize: 11,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 8,
  },
  totalCount: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginRight: 12 },
  totalPrice: { fontSize: 20, fontFamily: "NunitoSans_800ExtraBold", color: Colors.accent },
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  paymentLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  paymentText: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomInfo: { flex: 1 },
  bottomLabel: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  bottomTotal: { fontSize: 22, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 12,
  },
  orderBtnText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
});
