import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { fetchOrder, cancelOrder, approveAdjustment, startPayment, checkPaymentStatus, submitReview, createDispute, DISPUTE_CATEGORIES } from "@/lib/api";
import { RiderMap } from "@/components/rider-map";
import { formatMoney } from "@/lib/money";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";

const STATUS_STEPS = [
  { key: "placed", label: "Order Placed", icon: "checkmark-circle" },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-done-circle" },
  { key: "picked_up", label: "Picked Up", icon: "bicycle" },
  { key: "washing", label: "In Progress", icon: "water" },
  { key: "ready", label: "Ready", icon: "shirt" },
  { key: "delivered", label: "Delivered", icon: "home" },
];

function getStepIndex(status: string): number {
  if (status === "cancelled") return -1;
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // ── Dispute form state ───────────────────────────────
  const [showDispute, setShowDispute] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeError, setDisputeError] = useState("");

  // ── Rating state ─────────────────────────────────────
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  const orderQuery = useQuery<any>({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    // Live tracking: the shop/rider advance the order from their apps,
    // so poll while this screen is open (stale status also kept showing
    // a cancel button the backend would reject).
    refetchInterval: 15000,
  });
  const order = orderQuery.data;

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      orderQuery.refetch();
    },
    onError: (err: Error) => {
      Alert.alert("Cancel Failed", err.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveAdjustment(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      orderQuery.refetch();
    },
    onError: (err: Error) => {
      Alert.alert("Approval Failed", err.message);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => submitReview(id!, ratingStars, ratingComment.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      orderQuery.refetch();
      Alert.alert("Thanks for the feedback! ⭐", "Your rating helps other customers.");
    },
    onError: (err: Error) => {
      Alert.alert("Couldn't submit rating", err.message);
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const { checkoutUrl } = await startPayment(id!);
      // Hosted gateway checkout in the in-app browser; control
      // returns here when the user closes/finishes it.
      await WebBrowser.openBrowserAsync(checkoutUrl);
      // Confirm with the backend (it asks the gateway). Poll briefly —
      // gateway confirmation can lag the redirect by a few seconds.
      for (let i = 0; i < 5; i++) {
        const s = await checkPaymentStatus(id!);
        if (s.status !== "PENDING") return s;
        await new Promise((r) => setTimeout(r, 2000));
      }
      return { status: "PENDING", method: "COD" };
    },
    onSuccess: (s) => {
      orderQuery.refetch();
      if (s.status === "COLLECTED" || s.status === "SETTLED") {
        Alert.alert("Payment successful 🎉", "Your order is paid — nothing to pay at delivery.");
      } else {
        Alert.alert(
          "Payment not confirmed",
          "We couldn't confirm the payment yet. If you completed it, pull to refresh in a moment — otherwise you can pay cash at delivery.",
        );
      }
    },
    onError: (err: Error) => {
      Alert.alert("Payment failed to start", err.message);
    },
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      createDispute({
        orderId: id!,
        category: disputeCategory,
        description: disputeDescription.trim(),
      }),
    onSuccess: () => {
      setShowDispute(false);
      setDisputeCategory("");
      setDisputeDescription("");
      setDisputeError("");
      queryClient.invalidateQueries({ queryKey: ["my-disputes"] });
      Alert.alert("Dispute Submitted", "We'll review your issue and get back to you shortly.");
    },
    onError: (err: any) => {
      setDisputeError(err.message || "Failed to submit. Please try again.");
    },
  });

  function handleCancel() {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate() },
      ],
    );
  }

  if (orderQuery.isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Order not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 4) }]}>
        <Pressable style={styles.topBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Order Details</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shopCard}>
          <View>
            <Text style={styles.shopName}>{order.shopName}</Text>
            <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </Text>
        </View>

        {isCancelled ? (
          <View style={styles.cancelledCard}>
            <Ionicons name="close-circle" size={28} color={Colors.error} />
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        ) : (
          <View style={styles.trackingCard}>
            <Text style={styles.trackLabel}>Tracking</Text>
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepIndicator}>
                    <View style={[
                      styles.stepDot,
                      isCompleted && styles.stepDotActive,
                      isCurrent && styles.stepDotCurrent,
                    ]}>
                      <Ionicons
                        name={step.icon as any}
                        size={14}
                        color={isCompleted ? Colors.textInverse : Colors.textMuted}
                      />
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelActive,
                    isCurrent && styles.stepLabelCurrent,
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {order.riderName && !isCancelled && order.status !== "placed" && (
          <View style={styles.riderCard}>
            {order.riderPhotoUrl ? (
              <Image source={{ uri: order.riderPhotoUrl }} style={styles.riderPhoto} />
            ) : (
              <View style={[styles.riderPhoto, styles.riderPhotoFallback]}>
                <Ionicons name="person" size={22} color={Colors.primary} />
              </View>
            )}
            <View style={styles.riderInfo}>
              <Text style={styles.riderLabel}>
                {order.status === "delivered" ? "Delivered by" : "Your rider"}
              </Text>
              <Text style={styles.riderName}>{order.riderName}</Text>
            </View>
            <Ionicons name="bicycle" size={22} color={Colors.primary} />
          </View>
        )}

        {order.riderLat != null && order.riderLng != null &&
          order.customerLat != null && order.customerLng != null && (
          <View style={styles.mapSection}>
            <Text style={styles.detailHeading}>Live location</Text>
            <RiderMap
              rider={{ lat: order.riderLat, lng: order.riderLng }}
              dest={{ lat: order.customerLat, lng: order.customerLng }}
            />
            <Text style={styles.mapHint}>Rider's position updates as you watch.</Text>
          </View>
        )}

        {order.status === "delivered" && order.deliveryProofUrl && (
          <View style={styles.detailSection}>
            <Text style={styles.detailHeading}>Proof of Delivery</Text>
            <Image source={{ uri: order.deliveryProofUrl }} style={styles.proofImage} />
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.detailHeading}>Pickup</Text>
          <View style={styles.detailCard}>
            <DetailRow icon="calendar-outline" value={order.pickupDate} />
            <DetailRow icon="time-outline" value={order.pickupSlot} />
            <DetailRow icon="cash-outline" value="Cash on Delivery" />
          </View>
        </View>

        {order.adjustmentStatus === "PENDING" && order.proposedTotalAmount != null && (
          <View style={styles.approvalCard}>
            <View style={styles.approvalHeader}>
              <Ionicons name="scale-outline" size={20} color="#FFB020" />
              <Text style={styles.approvalTitle}>Price updated after weighing</Text>
            </View>
            <Text style={styles.approvalText}>
              Your laundry weighed more than estimated. The new total is{" "}
              <Text style={styles.approvalNew}>{formatMoney(order.proposedTotalAmount)}</Text>
              {" "}(estimated {formatMoney(order.originalTotalAmount ?? order.total)}).
              Approve to continue \u2014 your order is on hold until then.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.approvalBtn,
                pressed && { opacity: 0.85 },
                approveMutation.isPending && { opacity: 0.6 },
              ]}
              onPress={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <Text style={styles.approvalBtnText}>Approve New Price</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.detailSection}>
          <Text style={styles.detailHeading}>Items</Text>
          <View style={styles.detailCard}>
            {items.map((item: any, i: number) => {
              const qty = item.actualQuantity ?? item.quantity;
              return (
                <View key={i} style={[styles.itemRow, i < items.length - 1 && styles.itemBorder]}>
                  <Text style={styles.itemName}>
                    {item.name}
                    {item.actualQuantity != null ? " (weighed)" : ""}
                  </Text>
                  <Text style={styles.itemQty}>x{qty}</Text>
                  <Text style={styles.itemPrice}>{formatMoney(Math.round(item.price * qty))}</Text>
                </View>
              );
            })}
            <View style={styles.totalDivider} />
            <View style={styles.itemRow}>
              <Text style={styles.feeLabel}>Items</Text>
              <Text style={styles.feeValue}>{formatMoney(order.total)}</Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.feeLabel}>Pickup & delivery</Text>
              <Text style={styles.feeValue}>{formatMoney(order.deliveryFee ?? 0)}</Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.feeLabel}>Platform fee</Text>
              <Text style={styles.feeValue}>{formatMoney(order.platformFee ?? 0)}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.itemRow}>
              <Text style={styles.totalLabel}>Total to pay</Text>
              <Text style={styles.totalPrice}>
                {formatMoney(order.payment?.amount ?? order.total + (order.deliveryFee ?? 0) + (order.platformFee ?? 0))}
              </Text>
            </View>
            {order.payment?.method === "UPI" &&
              (order.payment?.status === "COLLECTED" || order.payment?.status === "SETTLED") && (
              <View style={styles.paidChip}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.paidChipText}>Paid online — nothing due at delivery</Text>
              </View>
            )}
          </View>
        </View>

        {order.payment?.status === "PENDING" &&
          order.adjustmentStatus !== "PENDING" &&
          !isCancelled &&
          order.status !== "delivered" && (
          <Pressable
            style={({ pressed }) => [
              styles.payBtn,
              pressed && { opacity: 0.85 },
              payMutation.isPending && { opacity: 0.6 },
            ]}
            onPress={() => payMutation.mutate()}
            disabled={payMutation.isPending}
          >
            {payMutation.isPending ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <Ionicons name="flash" size={16} color={Colors.textInverse} />
                <Text style={styles.payBtnText}>
                  Pay {formatMoney(order.payment.amount)} now with UPI
                </Text>
              </>
            )}
          </Pressable>
        )}

        {order.status === "placed" && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelBigBtn,
              pressed && { opacity: 0.85 },
              cancelMutation.isPending && { opacity: 0.6 },
            ]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle" size={16} color={Colors.error} />
                <Text style={styles.cancelBigText}>Cancel Order</Text>
              </>
            )}
          </Pressable>
        )}

        {order.status === "delivered" && (
          order.reviewRating != null ? (
            <View style={styles.ratedCard}>
              <Text style={styles.ratedLabel}>Your rating</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons
                    key={n}
                    name={n <= order.reviewRating ? "star" : "star-outline"}
                    size={22}
                    color={n <= order.reviewRating ? "#FFB020" : Colors.textMuted}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.rateCard}>
              <Text style={styles.rateTitle}>Rate {order.shopName}</Text>
              <Text style={styles.rateSub}>How was your laundry experience?</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRatingStars(n)} hitSlop={6}>
                    <Ionicons
                      name={n <= ratingStars ? "star" : "star-outline"}
                      size={34}
                      color={n <= ratingStars ? "#FFB020" : Colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.rateInput}
                placeholder="Add a comment (optional)"
                placeholderTextColor={Colors.textMuted}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                maxLength={500}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.rateSubmit,
                  (ratingStars === 0 || reviewMutation.isPending) && styles.rateSubmitDisabled,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => reviewMutation.mutate()}
                disabled={ratingStars === 0 || reviewMutation.isPending}
              >
                {reviewMutation.isPending ? (
                  <ActivityIndicator color={Colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.rateSubmitText}>Submit rating</Text>
                )}
              </Pressable>
            </View>
          )
        )}

        {(order.status === "delivered" || order.status === "cancelled") && (
          <Pressable
            style={({ pressed }) => [styles.reorderBigBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              router.push({
                pathname: "/order/new",
                params: { shopId: order.shopId, reorderItems: JSON.stringify(order.items) },
              });
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.textInverse} />
            <Text style={styles.reorderBigText}>Reorder</Text>
          </Pressable>
        )}

        {/* Help / Raise Dispute button — available for all non-cancelled orders */}
        {order.status !== "cancelled" && (
          <Pressable
            style={({ pressed }) => [styles.disputeBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowDispute(true)}
          >
            <Ionicons name="help-circle-outline" size={16} color={Colors.warning} />
            <Text style={styles.disputeBtnText}>Help / Raise Dispute</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Dispute Modal ─────────────────────────────── */}
      <Modal
        visible={showDispute}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDispute(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise a Dispute</Text>
              <Pressable onPress={() => setShowDispute(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>

            {!!disputeError && (
              <View style={styles.disputeErrorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.disputeErrorText}>{disputeError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoriesGrid}>
              {DISPUTE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    disputeCategory === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setDisputeCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      disputeCategory === cat && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={Colors.textMuted}
              value={disputeDescription}
              onChangeText={setDisputeDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!disputeMutation.isPending}
            />

            <Pressable
              style={({ pressed }) => [
                styles.submitDisputeBtn,
                pressed && { opacity: 0.85 },
                disputeMutation.isPending && { opacity: 0.6 },
              ]}
              onPress={() => {
                if (!disputeCategory) {
                  setDisputeError("Please select a category");
                  return;
                }
                if (!disputeDescription.trim()) {
                  setDisputeError("Please provide a description");
                  return;
                }
                setDisputeError("");
                disputeMutation.mutate();
              }}
              disabled={disputeMutation.isPending}
            >
              {disputeMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <Text style={styles.submitDisputeBtnText}>Submit Dispute</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, value }: { icon: string; value?: string | null }) {
  // Skip rows with no value rather than showing an empty line.
  if (!value || !String(value).trim()) return null;
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon as any} size={15} color={Colors.textSecondary} />
      </View>
      <Text style={styles.detailValue}>{value}</Text>
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
  shopCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shopName: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  orderId: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.primary, marginTop: 3 },
  orderDate: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  cancelledCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
  },
  cancelledText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trackLabel: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepIndicator: { alignItems: "center", marginRight: 14 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotCurrent: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepLine: { width: 2, height: 22, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLabel: { fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted, paddingTop: 5 },
  stepLabelActive: { fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  stepLabelCurrent: { fontFamily: "NunitoSans_700Bold", color: Colors.accent },
  riderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  riderPhoto: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surfaceElevated },
  riderPhotoFallback: { justifyContent: "center", alignItems: "center" },
  riderInfo: { flex: 1 },
  riderLabel: { fontSize: 12, fontFamily: "NunitoSans_400Regular", color: Colors.textMuted },
  riderName: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text, marginTop: 1 },
  proofImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
  },
  detailSection: { marginBottom: 16 },
  mapSection: { marginBottom: 16 },
  mapHint: {
    fontSize: 12,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textMuted,
    marginTop: 6,
  },
  detailHeading: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  detailValue: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  itemName: { flex: 1, fontSize: 14, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  itemQty: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textMuted, marginRight: 14 },
  itemPrice: { fontSize: 14, fontFamily: "NunitoSans_600SemiBold", color: Colors.text, minWidth: 50, textAlign: "right" },
  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  totalLabel: { flex: 1, fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  totalPrice: { fontSize: 20, fontFamily: "NunitoSans_800ExtraBold", color: Colors.accent },
  feeLabel: { flex: 1, fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary },
  feeValue: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.text },
  rateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
  },
  rateTitle: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  rateSub: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.textSecondary, marginTop: 2, marginBottom: 12 },
  starRow: { flexDirection: "row", gap: 6 },
  rateInput: {
    width: "100%",
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginTop: 14,
    minHeight: 60,
    fontSize: 14,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.text,
    textAlignVertical: "top",
  },
  rateSubmit: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  rateSubmitDisabled: { opacity: 0.5 },
  rateSubmitText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  ratedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  ratedLabel: { fontSize: 13, fontFamily: "NunitoSans_600SemiBold", color: Colors.textSecondary },
  paidChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.successLight,
  },
  paidChipText: { fontSize: 13, fontFamily: "NunitoSans_700Bold", color: Colors.success },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 16,
  },
  payBtnText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  approvalCard: {
    backgroundColor: "rgba(255, 176, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 176, 32, 0.35)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  approvalHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  approvalTitle: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: "#FFB020" },
  approvalText: {
    fontSize: 13,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  approvalNew: { fontFamily: "NunitoSans_800ExtraBold", color: Colors.text },
  approvalBtn: {
    backgroundColor: "#FFB020",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  approvalBtnText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: "#1A1A1A" },
  reorderBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  reorderBigText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.textInverse },
  cancelBigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.errorLight,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
  },
  cancelBigText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.error },
  disputeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  disputeBtnText: { fontSize: 16, fontFamily: "NunitoSans_700Bold", color: Colors.warning },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: "NunitoSans_700Bold", color: Colors.text },
  disputeErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
  },
  disputeErrorText: { fontSize: 13, fontFamily: "NunitoSans_400Regular", color: Colors.error, flex: 1 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: "NunitoSans_600SemiBold",
    color: Colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.primary,
  },
  textArea: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "NunitoSans_400Regular",
    color: Colors.text,
    minHeight: 100,
  },
  submitDisputeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitDisputeBtnText: {
    fontSize: 16,
    fontFamily: "NunitoSans_700Bold",
    color: Colors.textInverse,
  },
});
