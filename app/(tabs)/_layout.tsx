import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "#222",
        },
        tabBarActiveTintColor: "#FFD400",
        tabBarInactiveTintColor: "#666",
      }}
    >
      {/* TAB: Alarmas */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Alarmas",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>⏰</Text>
          ),
        }}
      />

      {/* TAB OCULTO: Nueva alarma */}
      <Tabs.Screen
        name="newAlarm"
        options={{
          href: null, // 👈 oculto del tab bar
        }}
      />

      {/* TAB: Ajustes (opcional) */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>⚙️</Text>
          ),
        }}
      />
    </Tabs>
  );
}
