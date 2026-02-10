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
      <Tabs.Screen
        name="index"
        options={{
          title: "Alarmas",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>⏰</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
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
 