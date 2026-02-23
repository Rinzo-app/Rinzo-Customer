import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomerOrders } from "@/lib/api";
import Colors from "@/constants/colors";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  placed: { label: "Placed", color: Colors.primary, bg: Colors.primaryMuted, icon: "checkmark-circle" },
  confirmed: { label: "Confirmed", color: Colors.primary, bg: Colors.primaryMuted, icon: "checkmark-done-circle" },
  picked_up: { label: "Picked Up", color: Colors.warning, bg: Colors.warningLight, icon: "bicycle" },
  washing: { label: "Washing", color: Colors.primary, bg: Colors.primaryMuted, icon: "water" },
  ready: { label: "Ready", color: Colors.success, bg: Colors.successLight, icon: "shirt" },
  delivered: { label: "Delivered", color: Colors.success, bg: Colors.successLight, icon: "checkmark-circle" },
  cancelled: { label: "Cancelled", color: Colors.error, bg: Colors.errorLight, icon: "close-circle" },
};

function OrderCard({ order }: { order: any }) {
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.placed;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
  const date = new Date(order.createdAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderLeft}>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.orderDate}>
            {date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={12} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.orderMid}>
        <Text style={styles.itemCount}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
        <Text style={styles.orderTotal}>{"\u20B9"}{order.total}</Text>
      </View>

      <View style={styles.orderBottom}>
        <View style={styles.pickupRow}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.pickupInfo}>{order.pickupDate}</Text>
        </View>
        {(order.status === "delivered" || order.status === "cancelled") && (
          <Pressable
            style={styles.reorderBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/order/new",
                params: { shopId: order.shopId, reorderItems: JSON.stringify(order.items) },
              });
            }}
          >
            <Ionicons name="refresh" size={13} color={Colors.accent} />
            <Text style={styles.reorderText}>Reorder</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const ordersQuery = useQuery<any[]>({ queryKey: ["customer-orders"], queryFn: fetchCustomerOrders });

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>Orders</Text>
      </View>

      {ordersQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-outline" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your laundry orders will show up here</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push("/(tabs)")}>
            <Text style={styles.browseBtnText}>Find a Shop</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={ordersQuery.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!ordersQuery.isRefetching}
              onRefresh={() => ordersQuery.refetch()}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => <OrderCard order={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  titleBar: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12 },
  title: { fontSize: 26, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
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
  browseBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  browseBtnText: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  orderLeft: {},
  shopName: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  orderDate: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "NunitoSans_700Bold" },
  orderMid: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemCount: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  orderTotal: { fontSize: 20, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  orderBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickupRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pickupInfo: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  reorderBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  reorderText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.accent },
});
