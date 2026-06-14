import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Platform, Image } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { fetchShops } from "@/lib/api";
import Colors from "@/constants/colors";
import type { Shop } from "@/lib/types";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const shopsQuery = useQuery<Shop[]>({ queryKey: ["shops"], queryFn: fetchShops });
  const favsQuery = useQuery<any[]>({ queryKey: ["/api/favorites"] });

  const favIds = new Set((favsQuery.data ?? []).map((f: any) => f.shopId));
  const favShops = (shopsQuery.data ?? []).filter((s) => favIds.has(s.id));
  const loading = shopsQuery.isLoading || favsQuery.isLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Favorites</Text>
        <View style={styles.topBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : favShops.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>Tap the heart on a shop to save it here.</Text>
        </View>
      ) : (
        <FlatList
          data={favShops}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: "/shop/[id]", params: { id: item.id } })}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}><MaterialCommunityIcons name="washing-machine" size={24} color={Colors.primary} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{item.address}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "NunitoSans_700Bold", color: Colors.text, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: Colors.primaryMuted, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  sub: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2 },
});
