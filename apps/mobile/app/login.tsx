import { useState, useRef, useEffect } from "react";
import {
  View, KeyboardAvoidingView, Platform,
  TouchableOpacity, TextInput as RNTextInput, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Text } from "react-native-paper";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import { verifyFirebaseToken, savePushToken } from "@/src/api/auth";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, ACCENT, ACCENT_2, BgBlobs, GlassCard } from "@/src/theme";

async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing === "granted"
      ? { status: existing }
      : await Notifications.requestPermissionsAsync();
    if (status !== "granted") return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

type Step = "phone" | "otp";
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;

export default function LoginScreen() {
  const { login } = useAuth();
  const t = useTheme();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const otpRefs = useRef<(RNTextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inputBg = t.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)";
  const inputBorder = t.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)";

  useEffect(() => {
    if (step === "otp") setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, [step]);

  function startOtpTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setOtpTimer(OTP_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function handleSendOtp() {
    if (!/^\d{10}$/.test(phone)) { setError("Enter a valid 10-digit mobile number."); return; }
    setError(""); setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      confirmationRef.current = confirmation;
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStep("otp");
      startOtpTimer();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    const otp = otpDigits.join("");
    if (otp.length !== OTP_LENGTH) { setError("Enter the 6-digit OTP."); return; }
    if (!confirmationRef.current) { setError("Session expired. Please resend OTP."); return; }
    setError(""); setLoading(true);
    try {
      const credential = await confirmationRef.current.confirm(otp);
      if (!credential?.user) throw new Error("Verification failed.");
      const idToken = await credential.user.getIdToken();
      const { token, parent } = await verifyFirebaseToken(idToken);
      await AsyncStorage.setItem("auth_token", token);
      await AsyncStorage.setItem("parent", JSON.stringify(parent));
      login(phone);
      router.replace("/(tabs)");
      registerForPushNotifications()
        .then((pushToken) => { if (pushToken) savePushToken(parent.id, pushToken); })
        .catch(() => {});
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      const msg = err instanceof Error ? err.message : "OTP verification failed.";
      if (code === "auth/session-expired" || code === "auth/code-expired") {
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setError("OTP expired. Tap 'Resend OTP' to get a new code.");
        if (timerRef.current) clearInterval(timerRef.current);
        setOtpTimer(0);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError(msg || "Verification failed. Please try again.");
      }
    } finally { setLoading(false); }
  }

  function handleOtpChange(value: string, index: number) {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const newDigits = [...otpDigits];
      for (let i = 0; i < digits.length; i++) {
        newDigits[index + i < OTP_LENGTH ? index + i : OTP_LENGTH - 1] = digits[i];
      }
      setOtpDigits(newDigits);
      otpRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "");
    const newDigits = [...otpDigits]; newDigits[index] = digit;
    setOtpDigits(newDigits); setError("");
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyPress(e: { nativeEvent: { key: string } }, index: number) {
    if (e.nativeEvent.key === "Backspace" && !otpDigits[index] && index > 0) {
      const newDigits = [...otpDigits]; newDigits[index - 1] = "";
      setOtpDigits(newDigits);
      otpRefs.current[index - 1]?.focus();
    }
  }

  // ── Phone step ─────────────────────────────────────────────────────────────
  if (step === "phone") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <BgBlobs />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Back button (goes to onboarding) */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, zIndex: 2 }}>
              <TouchableOpacity
                onPress={() => router.replace("/onboarding")}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="arrow-back" size={18} color={t.text2} />
              </TouchableOpacity>
            </View>

            {/* Logo */}
            <View style={{ alignItems: "center", marginTop: 12, marginBottom: 20, zIndex: 2 }}>
              <View style={{ backgroundColor: "white", borderRadius: 16, padding: 8, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
                <Image source={require("@/assets/images/kap_logo.png")} style={{ width: 140, height: 56 }} contentFit="contain" />
              </View>
            </View>

            {/* Eyebrow + title + subtitle */}
            <View style={{ paddingHorizontal: 24, alignItems: "center", zIndex: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: ACCENT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Parent Login
              </Text>
              <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5, textAlign: "center", lineHeight: 32, marginBottom: 10 }}>
                Enter your registered{"\n"}mobile number
              </Text>
              <Text style={{ fontSize: 13, color: t.text2, textAlign: "center", lineHeight: 20, marginBottom: 28, maxWidth: 300 }}>
                We'll send a 6-digit OTP to verify it's you. Use the number you shared at admission.
              </Text>
            </View>

            {/* Phone input — glass card */}
            <View style={{ paddingHorizontal: 24, zIndex: 2 }}>
              <GlassCard intensity={55} style={{ flexDirection: "row", alignItems: "center", borderRadius: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 16, paddingRight: 14, borderRightWidth: 1, borderRightColor: t.divider, paddingVertical: 16 }}>
                  <Text style={{ fontSize: 18 }}>🇮🇳</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>+91</Text>
                  <Ionicons name="chevron-down" size={12} color={t.text3} />
                </View>
                <RNTextInput
                  style={{ flex: 1, fontSize: 18, fontWeight: "700", color: t.text, paddingHorizontal: 16, paddingVertical: 16, letterSpacing: 0.5 }}
                  placeholder="00000 00000"
                  placeholderTextColor={t.text3}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(v) => { setPhone(v.replace(/\D/g, "")); setError(""); }}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </GlassCard>

              {/* Security note */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12 }}>
                <Ionicons name="shield-outline" size={13} color={t.text3} />
                <Text style={{ fontSize: 11, color: t.text3 }}>Secured by KAP Edutech. We never share your number.</Text>
              </View>

              {/* Error */}
              {error ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginTop: 12, borderLeftWidth: 3, borderLeftColor: "#DC2626" }}>
                  <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
                  <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{error}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ flex: 1, minHeight: 40 }} />

            {/* CTA */}
            <View style={{ paddingHorizontal: 24, paddingBottom: 12, zIndex: 2 }}>
              <TouchableOpacity onPress={handleSendOtp} disabled={loading} activeOpacity={0.88}>
                <LinearGradient
                  colors={[ACCENT, ACCENT_2]}
                  start={[0, 0]} end={[1, 0]}
                  style={[{ height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, loading && { opacity: 0.6 }]}
                >
                  <Text style={{ color: "white", fontSize: 16, fontWeight: "700", letterSpacing: 0.1 }}>
                    {loading ? "Sending OTP..." : "Send OTP"}
                  </Text>
                  {!loading && <Ionicons name="arrow-forward" size={18} color="white" />}
                </LinearGradient>
              </TouchableOpacity>
              <Text style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: t.text3 }}>
                Trouble logging in?{" "}
                <Text style={{ color: ACCENT, fontWeight: "700" }}>Contact institute</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── OTP step ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <BgBlobs />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Back button */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, zIndex: 2 }}>
            <TouchableOpacity
              onPress={() => { setStep("phone"); setOtpDigits(Array(OTP_LENGTH).fill("")); setError(""); confirmationRef.current = null; }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="arrow-back" size={18} color={t.text2} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={{ alignItems: "center", marginTop: 12, marginBottom: 20, zIndex: 2 }}>
            <View style={{ backgroundColor: "white", borderRadius: 16, padding: 8, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <Image source={require("@/assets/images/kap_logo.png")} style={{ width: 120, height: 48 }} contentFit="contain" />
            </View>
          </View>

          {/* Eyebrow + title */}
          <View style={{ paddingHorizontal: 24, alignItems: "center", zIndex: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: ACCENT, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
              Verification
            </Text>
            <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5, textAlign: "center", lineHeight: 32, marginBottom: 10 }}>
              Enter the 6-digit code
            </Text>
            <Text style={{ fontSize: 13, color: t.text2, textAlign: "center", lineHeight: 20, marginBottom: 8 }}>
              Sent to <Text style={{ color: t.text, fontWeight: "700" }}>+91 {phone}</Text>
              {" "}·{" "}
              <Text
                style={{ color: ACCENT, fontWeight: "700" }}
                onPress={() => { setStep("phone"); setOtpDigits(Array(OTP_LENGTH).fill("")); setError(""); confirmationRef.current = null; }}
              >
                Change
              </Text>
            </Text>

            {/* Timer */}
            {otpTimer > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <Ionicons name="time-outline" size={13} color={otpTimer <= 60 ? "#DC2626" : ACCENT} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: otpTimer <= 60 ? "#DC2626" : ACCENT }}>
                  Resend in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>

          {/* OTP boxes */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 24, marginTop: 20, zIndex: 2 }}>
            {otpDigits.map((digit, i) => (
              <RNTextInput
                key={i}
                ref={(ref) => { otpRefs.current[i] = ref; }}
                style={{
                  flex: 1, height: 58,
                  borderWidth: 1.5,
                  borderColor: digit ? ACCENT : inputBorder,
                  borderRadius: 14,
                  backgroundColor: digit ? `rgba(31,168,224,0.12)` : inputBg,
                  fontSize: 24, fontWeight: "800", color: t.text,
                  textAlign: "center",
                }}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, i)}
                onKeyPress={(e) => handleOtpKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginTop: 12, marginHorizontal: 24, borderLeftWidth: 3, borderLeftColor: "#DC2626", zIndex: 2 }}>
              <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {/* Resend */}
          <View style={{ alignItems: "center", marginTop: 20, zIndex: 2 }}>
            {otpTimer === 0 ? (
              <TouchableOpacity onPress={() => { setOtpDigits(Array(OTP_LENGTH).fill("")); handleSendOtp(); }}>
                <Text style={{ fontSize: 13, color: ACCENT, fontWeight: "700" }}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: 13, color: t.text3 }}>
                Resend available after timer
              </Text>
            )}
          </View>

          <View style={{ flex: 1, minHeight: 32 }} />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, zIndex: 2 }}>
            <TouchableOpacity onPress={handleVerifyOtp} disabled={loading} activeOpacity={0.88}>
              <LinearGradient
                colors={[ACCENT, ACCENT_2]}
                start={[0, 0]} end={[1, 0]}
                style={[{ height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, loading && { opacity: 0.6 }]}
              >
                <Text style={{ color: "white", fontSize: 16, fontWeight: "700", letterSpacing: 0.1 }}>
                  {loading ? "Verifying..." : "Verify & continue"}
                </Text>
                {!loading && <Ionicons name="checkmark" size={18} color="white" />}
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 14 }}>
              <MaterialCommunityIcons name="shield-lock-outline" size={13} color={t.text3} />
              <Text style={{ fontSize: 11, color: t.text3 }}>End-to-end encrypted · KAP Edutech</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
