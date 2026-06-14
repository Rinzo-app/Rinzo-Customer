import { useState, useEffect } from "react";
import * as Location from "expo-location";

export interface UserLocation {
  lat: number;
  lng: number;
  address: string | null;
}

/**
 * The device's current GPS location. Returns `null` until resolved, and
 * stays `null` if permission is denied or the fix fails — we never
 * fabricate a location (callers fall back to the saved delivery address
 * instead of guessing a city).
 */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: geo
            ? `${geo.city || geo.district || geo.region}, ${geo.country}`
            : null,
        });
      } catch (e) {
        console.warn("Location error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { location, loading, permissionDenied };
}
