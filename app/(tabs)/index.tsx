import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch } from "react-native";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

type Alarm = {
  id: number;
  hour: number;
  minute: number;
  name: string;
  description: string;
  enabled: boolean;
  notifId?: string;
};

export default function HomeScreen() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  const loadAlarms = async () => {
    const raw = await AsyncStorage.getItem("@alarms");
    if (raw) setAlarms(JSON.parse(raw));
  };

  useFocusEffect(() => {
    loadAlarms();
  });

  const toggleAlarm = async (alarm: Alarm) => {
    let updatedAlarm = { ...alarm, enabled: !alarm.enabled };

    if (updatedAlarm.enabled) {
      // programar notificación
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: updatedAlarm.name || "Alarma",
          body: updatedAlarm.description || "¡Es hora!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: updatedAlarm.hour,
          minute: updatedAlarm.minute,
          repeats: true,
        },
      });
      updatedAlarm.notifId = notifId;
    } else {
      // cancelar notificación
      if (updatedAlarm.notifId) {
        await Notifications.cancelScheduledNotificationAsync(updatedAlarm.notifId);
        updatedAlarm.notifId = undefined;
      }
    }

    const updatedAlarms = alarms.map(a => a.id === alarm.id ? updatedAlarm : a);
    setAlarms(updatedAlarms);
    await AsyncStorage.setItem("@alarms", JSON.stringify(updatedAlarms));
  };

  const removeAlarm = async (alarm: Alarm) => {
    if (alarm.notifId) {
      await Notifications.cancelScheduledNotificationAsync(alarm.notifId);
    }
    const next = alarms.filter((a) => a.id !== alarm.id);
    setAlarms(next);
    await AsyncStorage.setItem("@alarms", JSON.stringify(next));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("newAlarm")}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Alarmas</Text>

      <FlatList
        data={alarms}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.alarmRow}>
            <View>
              <Text style={styles.time}>
                {String(item.hour).padStart(2, "0")}:
                {String(item.minute).padStart(2, "0")}
              </Text>

              <Text style={styles.name}>{item.name}</Text>

              {item.description.length > 0 && (
                <Text style={styles.desc}>{item.description}</Text>
              )}
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Switch
                value={item.enabled}
                onValueChange={() => toggleAlarm(item)}
                trackColor={{ false: "#555", true: "#FFD400" }}
                thumbColor={item.enabled ? "#000" : "#FFF"}
              />

              <TouchableOpacity onPress={() => removeAlarm(item)}>
                <Text style={styles.delete}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: { alignItems: "flex-end" },
  addButtonText: { color: "#FFD400", fontSize: 28, fontWeight: "700" },
  title: { color: "#FFD400", fontSize: 18, marginVertical: 12, fontWeight: "600" },
  alarmRow: {
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  time: { color: "#FFD400", fontSize: 18 },
  name: { color: "#FFF", fontWeight: "600", marginTop: 4 },
  desc: { color: "#AAA", fontSize: 12 },
  delete: { color: "#FFD400", fontWeight: "600", marginTop: 4 },
});
