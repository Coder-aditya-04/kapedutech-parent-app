import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { savePushToken } from "@/src/api/auth";
import { useTheme, ACCENT } from "@/src/theme";

// Notification storage is handled centrally in the root _layout.tsx
// (with proper deduplication by notification ID). Do NOT add listeners here.

async function ensurePushToken() {
  try {
    const Notifications = await import("expo-notifications");

    const parentStr = await AsyncStorage.getItem("parent");
    if (!parentStr) return;
    const parent = JSON.parse(parentStr);

    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing === "granted"
      ? { status: existing }
      : await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token.data) {
      await savePushToken(parent.id, token.data);
      console.log("[Push] Token registered:", token.data);
    }
  } catch (e) {
    console.log("[Push] Skipped:", (e as Error)?.message ?? e);
  }
}

export default function TabLayout() {
  const { phone } = useAuth();
  const t = useTheme();

  useEffect(() => {
    if (!phone) {
      setTimeout(() => router.replace("/login"), 0);
      return;
    }
    ensurePushToken();
  }, [phone]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: t.text3,
        tabBarStyle: {
          backgroundColor: t.card,
          borderTopColor: t.cardBorder,
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "home" : "home-outline"}
              color={color} size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "chart-bar" : "chart-bar"}
              color={color} size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "calendar-month" : "calendar-month-outline"}
              color={color} size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "bell" : "bell-outline"}
              color={color} size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "account-circle" : "account-circle-outline"}
              color={color} size={24}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
