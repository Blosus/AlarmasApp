import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import * as Notifications from "expo-notifications";
import DateTimePickerModal from "react-native-modal-datetime-picker";

export default function HomeScreen() {
  const [permissionStatus, setPermissionStatus] = useState<any>(null);
  const [date, setDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [alarms, setAlarms] = useState<Array<{ id: number; hour: number; minute: number; notifId?: string }>>([]);
  const [nextId, setNextId] = useState(1);

  // Comprobar permisos existentes al montar para no pedir cada vez
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
      } catch (e) {
        // Si falla, intentamos no bloquear la app — dejamos el estado como está
      }
    })();
  }, []);

  // Solicitar permisos al principio
  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
  };

  // Confirmar hora seleccionada: guardar y programar la alarma
  const handleConfirm = async (selectedDate: Date) => {
    setDate(selectedDate);
    hideDatePicker();
    await scheduleAlarm(selectedDate);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const scheduleAlarm = async (selectedDateParam?: Date) => {
    const selected = selectedDateParam ? new Date(selectedDateParam) : new Date(date);
    const hour = selected.getHours();
    const minute = selected.getMinutes();

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "¡Es hora de la alarma!",
        body: "¡Es hora de levantarse!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        repeats: true,
      },
    });

    const id = nextId;
    setNextId(id + 1);
    setAlarms((prev) => [...prev, { id, hour, minute, notifId }]);

    alert("Alarma programada! Se repetirá diariamente.");
  };

  const removeAlarm = async (alarmId: number) => {
    const alarm = alarms.find((a) => a.id === alarmId);
    if (alarm?.notifId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(alarm.notifId);
      } catch {}
    }
    setAlarms((prev) => prev.filter((a) => a.id !== alarmId));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.addButton} onPress={() => setDatePickerVisibility(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {permissionStatus === "granted" ? (
        <>
          <Text style={styles.listTitle}>Alarmas programadas:</Text>
          <FlatList
            data={alarms}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.alarmRow}>
                <Text style={styles.alarmText}>{String(item.hour).padStart(2, "0")}:{String(item.minute).padStart(2, "0")}</Text>
                <TouchableOpacity style={styles.smallButton} onPress={() => removeAlarm(item.id)}>
                  <Text style={styles.smallButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      ) : (
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Pedir permiso para notificaciones</Text>
        </TouchableOpacity>
      )}

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="time"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    color: "#FFD400",
    marginBottom: 20,
    fontWeight: "700",
  },
  header: {
    width: "100%",
    position: "relative",
    alignItems: "center",
    marginBottom: 8,
  },
  addButton: {
    position: "absolute",
    right: 0,
    top: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFD400",
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#FFD400",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#000",
    fontWeight: "600",
  },
  listTitle: {
    color: "#FFD400",
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  alarmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    marginBottom: 8,
  },
  alarmText: {
    color: "#FFD400",
    fontSize: 18,
  },
  smallButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FFD400",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallButtonText: {
    color: "#FFD400",
  },
});
