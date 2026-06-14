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
  Image,
  AppState,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/query-client";
import { fetchShops } from "@/lib/api";
import { useUserLocation } from "@/lib/use-location";
import { formatHoursRange } from "@/lib/time";
import Colors from "@/constants/colors";
import type { Shop, Address } from "@/lib/types";

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
        {shop.imageUrl ? (
          <Image source={{ uri: shop.imageUrl }} style={styles.shopAvatar} />
        ) : (
          <View style={styles.shopAvatar}>
            <MaterialCommunityIcons name="washing-machine" size={26} color={Colors.primary} />
          </View>
        )}
        <View style={styles.shopInfo}>
          <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
          <View style={styles.ratingRow}>
            {(shop.totalRatings ?? 0) > 0 ? (
              <>
                <Ionicons name="star" size={13} color={Colors.star} />
                <Text style={styles.ratingText}>{shop.rating?.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({shop.totalRatings})</Text>
              </>
            ) : (
              <Text style={styles.ratingCount}>New</Text>
            )}
            <View style={styles.dot} />
            <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.distanceText}>{distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}</Text>
          </View>
        </View>
        <Pressable style={styles.favBtn} onPress={onToggleFav} hitSlop={12}>
          <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? Colors.error : Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.shopMeta}>
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{formatHoursRange(shop.openTime, shop.closeTime)}</Text>
        </View>
        {/* Delivery is distance-priced per order \u2014 the exact fee is
            shown in the checkout breakdown, so no misleading
            "free pickup" badges here. */}
      </View>

      <Text style={styles.shopAddress} numberOfLines={1}>{shop.address}</Text>

      <View style={styles.viewRow}>
        <Text style={styles.viewText}>View Services</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { customer, emailVerified, resendVerification, reloadEmailStatus } = useAuth();
  const { location, loading: locationLoading, permissionDenied } = useUserLocation();
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [favsLoaded, setFavsLoaded] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  // Refresh verification status on mount + whenever the app returns to
  // the foreground (the user verifies via a browser link, then comes back).
  React.useEffect(() => {
    reloadEmailStatus();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") reloadEmailStatus();
    });
    return () => sub.remove();
  }, [reloadEmailStatus]);

  const handleResend = useCallback(async () => {
    setResendState("sending");
    try {
      await resendVerification();
      setResendState("sent");
    } catch (e: any) {
      setResendState("idle");
      Alert.alert(
        "Couldn't send",
        e?.code === "auth/too-many-requests"
          ? "Too many attempts. Wait a few minutes — an email may already be in your inbox (check spam)."
          : "Please try again in a moment.",
      );
    }
  }, [resendVerification]);

  const shopsQuery = useQuery<Shop[]>({ queryKey: ["shops"], queryFn: fetchShops });
  const favsQuery = useQuery<any[]>({ queryKey: ["/api/favorites"] });
  const addressesQuery = useQuery<Address[]>({ queryKey: ["/api/addresses"] });

  // The customer's default saved address is the anchor for "shops near
  // me" — it's where deliveries go. Live GPS refines it when available;
  // we never fall back to a guessed city.
  const defaultAddr = useMemo(() => {
    const list = addressesQuery.data ?? [];
    return (
      list.find((a) => a.isDefault && a.lat != null && a.lng != null) ??
      list.find((a) => a.lat != null && a.lng != null) ??
      null
    );
  }, [addressesQuery.data]);

  const effLoc = useMemo(() => {
    if (location) return location;
    if (defaultAddr)
      return { lat: defaultAddr.lat, lng: defaultAddr.lng, address: defaultAddr.label };
    return null;
  }, [location, defaultAddr]);

  React.useEffect(() => {
    if (favsQuery.data && !favsLoaded) {
      const ids = new Set(favsQuery.data.map((f: any) => f.shopId));
      setFavSet(ids);
      setFavsLoaded(true);
    }
  }, [favsQuery.data, favsLoaded]);

  const sortedShops = useMemo(() => {
    if (!shopsQuery.data) return [];
    // Without any location (no GPS and no saved address) we can't judge
    // distance — show everything rather than a misleading empty list.
    if (!effLoc) {
      return shopsQuery.data.map((shop) => ({ shop, distance: 0 }));
    }
    const withDistance = shopsQuery.data
      .map((shop) => ({
        shop,
        distance: getDistance(effLoc.lat, effLoc.lng, shop.lat, shop.lng),
      }))
      .sort((a, b) => a.distance - b.distance);
    return withDistance.filter(
      ({ shop, distance }) => distance <= (shop.serviceRadiusKm ?? 5),
    );
  }, [shopsQuery.data, effLoc]);

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
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {effLoc?.address || (locationLoading ? "Locating…" : "Set delivery address")}
            </Text>
            <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {permissionDenied && !defaultAddr && (
        <Pressable style={styles.permBanner} onPress={() => router.push("/address/manage")}>
          <Text style={styles.permBannerText}>
            \ud83d\udccd Add a delivery address to see shops near you
          </Text>
        </Pressable>
      )}

      {customer && !emailVerified && (
        <View style={styles.verifyBanner}>
          <Ionicons name="mail-unread-outline" size={18} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifyTitle}>Verify your email</Text>
            <Text style={styles.verifyText}>
              {resendState === "sent"
                ? "Sent! Tap the link in your inbox, then reopen the app."
                : `We sent a link to ${customer.email ?? "your email"}. Verify to secure your account.`}
            </Text>
          </View>
          <Pressable
            onPress={handleResend}
            disabled={resendState === "sending"}
            style={({ pressed }) => [styles.verifyBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.verifyBtnText}>
              {resendState === "sending" ? "\u2026" : resendState === "sent" ? "Resend" : "Send"}
            </Text>
          </Pressable>
        </View>
      )}

      {shopsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : sortedShops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="washing-machine" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No shops nearby</Text>
          <Text style={styles.emptyText}>
            {effLoc && (shopsQuery.data?.length ?? 0) > 0
              ? "No shops deliver to your area yet — we're expanding soon."
              : "We'll add more laundry shops soon"}
          </Text>
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nearby</Text>
              <Text style={styles.sectionCount}>{sortedShops.length} shops</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ShopCard
              shop={item.shop}
              distance={item.distance}
              isFav={favSet.has(item.shop.id)}
              onToggleFav={() => toggleFav(item.shop.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
  greeting: {
    fontSize: 26,
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
  permBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 10,
  },
  permBannerText: {
    fontSize: 12,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  verifyTitle: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  verifyText: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 1 },
  verifyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyBtnText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.text,
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  shopHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  shopAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ratingText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.star },
  ratingCount: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted, marginHorizontal: 4 },
  distanceText: { fontSize: 12, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  favBtn: { padding: 4 },
  shopMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
  },
  metaText: { fontSize: 11, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  freeBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeText: { fontSize: 11, fontFamily: "NunitoSans_700Bold", color: Colors.success },
  shopAddress: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, marginBottom: 10 },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  viewText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.primary },
});
