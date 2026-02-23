import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, userStatus } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (userStatus === "PENDING" || userStatus === "SUSPENDED") {
      router.replace("/status-blocked" as Href);
      return;
    }

    // ACTIVE or status not yet loaded — allow entry
    router.replace("/(tabs)");
  }, [isLoading, isAuthenticated, userStatus]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
