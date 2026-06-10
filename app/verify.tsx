import { Redirect } from "expo-router";

// Phone-OTP verification was replaced by email/password auth.
// Kept as a redirect so stale deep links don't crash.
export default function VerifyScreen() {
  return <Redirect href="/login" />;
}
