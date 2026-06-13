import React, { useState, useCallback } from "react";
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
import { formatMoney } from "@/lib/money";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import { useCart } from "@/lib/cart-context";
import Colors from "@/constants/colors";
import type { Shop, Service } from "@/lib/types";


export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [isFav, setIsFav] = useState(false);
  const { cart, updateQty: ctxUpdateQty, cartCount } = useCart();
  const selectedItems = cart.shopId === id ? cart.items : {};

  const shopQuery = useQuery<Shop>({ queryKey: [`/api/shops/${id}`] });
  const servicesQuery = useQuery<Service[]>({ queryKey: [`/api/shops/${id}/services`] });
  const favQuery = useQuery({
    queryKey: [`/api/favorites/${id}/check`],
    select: (data: any) => data.isFavorite,
  });

  React.useEffect(() => {
    if (favQuery.data !== undefined) setIsFav(favQuery.data);
  }, [favQuery.data]);

  const shop = shopQuery.data;
  const services = servicesQuery.data || [];

  const totalItems = Object.values(selectedItems).reduce((s, q) => s + q, 0);
  const totalPrice = services.reduce((sum, svc) => sum + (selectedItems[svc.id] || 0) * svc.price, 0);

  const updateQty = useCallback((serviceId: string, delta: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ctxUpdateQty(id!, serviceId, delta);
  }, [id, ctxUpdateQty]);

  const toggleFav = async () => {
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await apiRequest("POST", `/api/favorites/${id}/toggle`);
      const data = await res.json();
      setIsFav(data.isFavorite);
    } catch {}
  };

  const handleProceed = () => {
    if (totalItems === 0) {
      Alert.alert("No items", "Please add at least one service to continue");
      return;
    }
    const items = services
      .filter((s) => selectedItems[s.id])
      .map((s) => ({
        serviceId: s.id,
        name: s.name,
        quantity: selectedItems[s.id],
        price: s.price,
      }));
    router.push({
      pathname: "/order/new",
      params: { shopId: id, items: JSON.stringify(items) },
    });
  };

  if (shopQuery.isLoading || servicesQuery.isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Shop not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{shop.name}</Text>
        <Pressable style={styles.topBtn} onPress={toggleFav}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? Colors.error : Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shopHeaderCard}>
          <View style={styles.shopIconLarge}>
            <MaterialCommunityIcons name="washing-machine" size={36} color={Colors.primary} />
          </View>
          <View style={styles.shopHeaderInfo}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={15} color={Colors.star} />
              <Text style={styles.ratingBig}>{shop.rating?.toFixed(1)}</Text>
              <Text style={styles.ratingCountBig}>({shop.totalRatings})</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.metaLabel}>{shop.openTime} - {shop.closeTime}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.metaLabel} numberOfLines={2}>{shop.address}</Text>
            </View>
            {/* Delivery fee is distance-priced — shown at checkout */}
          </View>
        </View>

        <Text style={styles.servicesHeading}>Services</Text>

        <View style={styles.categorySection}>
          {services.map((svc, i) => {
            const qty = selectedItems[svc.id] || 0;
            return (
              <View key={svc.id} style={[styles.serviceRow, i < services.length - 1 && styles.serviceRowBorder]}>
                <View style={styles.svcInfo}>
                  <Text style={styles.svcName}>{svc.name}</Text>
                  <Text style={styles.svcUnit}>{svc.unit}</Text>
                </View>
                <Text style={styles.svcPrice}>{formatMoney(svc.price)}</Text>
                {qty === 0 ? (
                  <Pressable style={styles.addBtn} onPress={() => updateQty(svc.id, 1)}>
                    <Ionicons name="add" size={16} color={Colors.primary} />
                  </Pressable>
                ) : (
                  <View style={styles.qtyRow}>
                    <Pressable style={styles.qtyBtn} onPress={() => updateQty(svc.id, -1)}>
                      <Ionicons name="remove" size={14} color={Colors.primary} />
                    </Pressable>
                    <Text style={styles.qtyText}>{qty}</Text>
                    <Pressable style={styles.qtyBtn} onPress={() => updateQty(svc.id, 1)}>
                      <Ionicons name="add" size={14} color={Colors.primary} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      {totalItems > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomItems}>{totalItems} item{totalItems !== 1 ? "s" : ""}</Text>
            <Text style={styles.bottomTotal}>{formatMoney(totalPrice)}</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.proceedBtn, pressed && { opacity: 0.85 }]} onPress={handleProceed}>
            <Text style={styles.proceedText}>Schedule Pickup</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
          </Pressable>
        </View>
      )}
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
  shopHeaderCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shopIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  shopHeaderInfo: { flex: 1, gap: 5 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingBig: { fontSize: 16, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  ratingCountBig: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  metaLabel: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, flex: 1 },
  freeBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  freeText: { fontSize: 11, fontFamily: "NunitoSans_700Bold", color: Colors.success },
  servicesHeading: {
    fontSize: 18,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  categorySection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: Colors.surfaceElevated,
  },
  catTitle: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  svcInfo: { flex: 1 },
  svcName: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  svcUnit: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginTop: 1 },
  svcPrice: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.accent, marginRight: 14, minWidth: 45, textAlign: "right" },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  qtyBtn: { width: 30, height: 30, justifyContent: "center", alignItems: "center" },
  qtyText: { fontSize: 14, fontFamily: "NunitoSans_700Bold", color: Colors.text, minWidth: 22, textAlign: "center" },
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
  bottomItems: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  bottomTotal: { fontSize: 22, fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  proceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  proceedText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
});
