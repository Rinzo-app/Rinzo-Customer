import React, { useState, useMemo, useCallback } from "react";
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
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";
import type { Shop } from "@shared/schema";

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ShopCard({ shop, distance, isFav, onToggleFav }: {
  shop: Shop; distance: number; isFav: boolean; onToggleFav: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.shopCard, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/shop/[id]", params: { id: shop.id } })}
    >
      <View style={styles.shopHeader}>
        <View style={styles.shopAvatar}>
          <MaterialCommunityIcons name="washing-machine" size={28} color={Colors.primary} />
        </View>
        <View style={styles.shopInfo}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color={Colors.star} />
            <Text style={styles.ratingText}>{shop.rating?.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({shop.totalRatings})</Text>
            <View style={styles.dot} />
            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.distanceText}>{distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</Text>
          </View>
        </View>
        <Pressable style={styles.favBtn} onPress={onToggleFav} hitSlop={12}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? Colors.error : Colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.shopMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{shop.openTime} - {shop.closeTime}</Text>
        </View>
        {shop.deliveryFee === 0 ? (
          <View style={styles.freeBadge}>
            <Text style={styles.freeText}>Free Pickup</Text>
          </View>
        ) : (
          <Text style={styles.metaText}>Pickup fee: {"\u20B9"}{shop.deliveryFee}</Text>
        )}
        {shop.minOrder && shop.minOrder > 0 && (
          <Text style={styles.metaText}>Min: {"\u20B9"}{shop.minOrder}</Text>
        )}
      </View>
      <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { customer } = useAuth();
  const [userLat] = useState(28.6139);
  const [userLng] = useState(77.2090);
  const [favSet, setFavSet] = useState<Set<string>>(new Set());

  const shopsQuery = useQuery<Shop[]>({ queryKey: ["/api/shops"] });
  const favsQuery = useQuery({
    queryKey: ["/api/favorites"],
    select: (data: any[]) => {
      const ids = new Set(data.map((f: any) => f.shopId));
      return ids;
    },
  });

  React.useEffect(() => {
    if (favsQuery.data) {
      setFavSet(favsQuery.data);
    }
  }, [favsQuery.data]);

  const sortedShops = useMemo(() => {
    if (!shopsQuery.data) return [];
    return shopsQuery.data
      .map((shop) => ({
        shop,
        distance: getDistance(userLat, userLng, shop.lat, shop.lng),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [shopsQuery.data, userLat, userLng]);

  const toggleFav = useCallback(async (shopId: string) => {
    try {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await apiRequest("POST", `/api/favorites/${shopId}/toggle`);
      const data = await res.json();
      setFavSet((prev) => {
        const next = new Set(prev);
        if (data.isFavorite) next.add(shopId);
        else next.delete(shopId);
        return next;
      });
    } catch {
    }
  }, []);

  const onRefresh = useCallback(() => {
    shopsQuery.refetch();
    favsQuery.refetch();
  }, []);

  const firstName = customer?.name?.split(" ")[0] || "there";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi {firstName}</Text>
          <Pressable style={styles.locationRow} onPress={() => router.push("/address/manage")}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>New Delhi, India</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {shopsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sortedShops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="washing-machine" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No shops nearby</Text>
          <Text style={styles.emptyText}>We'll add more laundry shops in your area soon</Text>
        </View>
      ) : (
        <FlatList
          data={sortedShops}
          keyExtractor={(item) => item.shop.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!shopsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              Nearby Laundry Shops ({sortedShops.length})
            </Text>
          }
          renderItem={({ item }) => (
            <ShopCard
              shop={item.shop}
              distance={item.distance}
              isFav={favSet.has(item.shop.id)}
              onToggleFav={() => toggleFav(item.shop.id)}
            />
          )}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "NunitoSans_800ExtraBold",
    color: Colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textSecondary,
    maxWidth: 200,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  shopHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#E0F7FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ratingText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  ratingCount: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted, marginHorizontal: 4 },
  distanceText: { fontSize: 12, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  favBtn: { padding: 4 },
  shopMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  freeBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeText: { fontSize: 11, fontFamily: "NunitoSans_700Bold", color: Colors.success },
  shopAddress: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
});
