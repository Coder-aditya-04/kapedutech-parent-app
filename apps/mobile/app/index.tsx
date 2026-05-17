import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { Text } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useTheme, ACCENT } from "@/src/theme";

export default function Index() {
  const { phone, isLoading } = useAuth();
  const t = useTheme();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("onboarding_done").then(val => {
      setOnboardingDone(val === "true");
    });
  }, []);

  if (isLoading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: t.text2, marginTop: 16, fontSize: 15, fontWeight: "600" }}>Loading...</Text>
      </View>
    );
  }

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  return <Redirect href={phone ? "/(tabs)" : "/login"} />;
}
