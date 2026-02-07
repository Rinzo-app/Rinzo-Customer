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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  placed: { label: "Order Placed", color: Colors.primary, bg: "#E0F7FA", icon: "checkmark-circle" },
  confirmed: { label: "Confirmed", color: Colors.primary, bg: "#E0F7FA", icon: "checkmark-done-circle" },
  picked_up: { label: "Picked Up", color: Colors.warning, bg: Colors.warningLight, icon: "bicycle" },
  washing: { label: "Washing", color: Colors.primary, bg: "#E0F7FA", icon: "water" },
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
        <View>
          <Text style={styles.shopName}>{order.shopName}</Text>
          <Text style={styles.orderDate}>
            {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={14} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.itemCount}>{itemCount} item{itemCount !== 1 ? "s" : ""}</Text>
        <Text style={styles.orderTotal}>{"\u20B9"}{order.total}</Text>
      </View>
      <View style={styles.reorderRow}>
        <Text style={styles.pickupInfo}>Pickup: {order.pickupDate} {order.pickupSlot}</Text>
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
            <Ionicons name="refresh" size={14} color={Colors.primary} />
            <Text style={styles.reorderText}>Reorder</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const ordersQuery = useQuery<any[]>({ queryKey: ["/api/orders"] });

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {ordersQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bag-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your orders will appear here</Text>
          <Pressable style={styles.browseBtn} onPress={() => router.push("/(tabs)")}>
            <Text style={styles.browseBtnText}>Browse Shops</Text>
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
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  titleBar: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  title: { fontSize: 24, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  browseBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  browseBtnText: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: "#fff" },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  shopName: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  orderDate: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "NunitoSans_700Bold" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemCount: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  orderTotal: { fontSize: 18, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  reorderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickupInfo: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  reorderBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  reorderText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.primary },
});
