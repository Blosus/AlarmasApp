import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useState } from "react";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export default function NewAlarmScreen() {
  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const saveAlarm = async () => {
    if (!date) return;

    const hour = date.getHours();
    const minute = date.getMinutes();

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: name || "Alarma",
        body: description || "¡Es hora!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        repeats: true,
      },
    });

    const raw = await AsyncStorage.getItem("@alarms");
    const alarms = raw ? JSON.parse(raw) : [];

    const newAlarm = {
      id: Date.now(),
      hour,
      minute,
      name,
      description,
      enabled: true, // 🔥 activada por defecto
      notifId,
    };

    await AsyncStorage.setItem(
      "@alarms",
      JSON.stringify([...alarms, newAlarm])
    );

    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nueva alarma</Text>

      <TouchableOpacity
        style={styles.timeButton}
        onPress={() => setShowPicker(true)}
      >
        <Text style={styles.timeText}>
          {date
            ? `${String(date.getHours()).padStart(2, "0")}:${String(
                date.getMinutes()
              ).padStart(2, "0")}`
            : "Seleccionar hora"}
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Nombre"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholder="Descripción"
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { height: 80 }]}
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveAlarm}>
        <Text style={styles.saveText}>Guardar alarma</Text>
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={showPicker}
        mode="time"
        onConfirm={(d) => {
          setDate(d);
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingTop: 60, paddingHorizontal: 20 },
  title: { color: "#FFD400", fontSize: 18, marginBottom: 20, fontWeight: "600" },
  timeButton: { backgroundColor: "#111", padding: 16, borderRadius: 8, marginBottom: 16 },
  timeText: { color: "#FFD400", fontSize: 18 },
  input: { backgroundColor: "#111", color: "#FFF", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#222", marginBottom: 12 },
  saveButton: { backgroundColor: "#FFD400", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 12 },
  saveText: { color: "#000", fontWeight: "700" },
});
