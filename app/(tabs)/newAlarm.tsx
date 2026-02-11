import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

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
      enabled: true,
      notifId,
    };

    await AsyncStorage.setItem(
      "@alarms",
      JSON.stringify([...alarms, newAlarm])
    );

    router.back();
  };

  const formatTime = () => {
    if (!date) return "Seleccionar hora";
    const period = date.getHours() >= 12 ? "PM" : "AM";
    const displayHour = date.getHours() % 12 || 12;
    return `${String(displayHour).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${period}`;
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFD54F" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Nueva Alarma</Text>
          <Text style={styles.stepIndicator}>Paso 1 de 2</Text>
        </View>
        
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Selección de Hora */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hora de la Alarma</Text>
          <Text style={styles.sectionDescription}>
            Selecciona la hora exacta para tu nueva alarma
          </Text>
          
          <TouchableOpacity
            style={styles.timeSelector}
            onPress={() => setShowPicker(true)}
          >
            <View style={styles.timeIconContainer}>
              <Ionicons name="time-outline" size={24} color="#FFD54F" />
            </View>
            
            <View style={styles.timeInfo}>
              <Text style={styles.timeLabel}>Hora seleccionada</Text>
              <Text style={styles.timeValue}>
                {date ? formatTime() : "No seleccionada"}
              </Text>
            </View>
            
            <Ionicons name="chevron-forward" size={20} color="#888888" />
          </TouchableOpacity>

          <View style={styles.timeTip}>
            <Ionicons name="information-circle-outline" size={16} color="#FFD54F" />
            <Text style={styles.timeTipText}>
              Hora actual: {getCurrentTime()}
            </Text>
          </View>
        </View>

        {/* Nombre de la Alarma */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nombre de la Alarma</Text>
          <Text style={styles.sectionDescription}>
            Asigna un nombre descriptivo a tu alarma (opcional)
          </Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag-outline" size={20} color="#FFD54F" style={styles.inputIcon} />
            <TextInput
              placeholder="Ej: Despertar, Medicamento, Reunión"
              placeholderTextColor="#888888"
              value={name}
              onChangeText={setName}
              style={styles.input}
              maxLength={30}
            />
            {name.length > 0 && (
              <Text style={styles.charCounter}>{name.length}/30</Text>
            )}
          </View>
        </View>

        {/* Descripción */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.sectionDescription}>
            Agrega notas o recordatorios adicionales (opcional)
          </Text>
          
          <View style={styles.textAreaContainer}>
            <Ionicons name="document-text-outline" size={20} color="#FFD54F" style={styles.textAreaIcon} />
            <TextInput
              placeholder="Ej: Tomar medicamento con agua, Reunión importante, Ejercicio matutino"
              placeholderTextColor="#888888"
              value={description}
              onChangeText={setDescription}
              style={styles.textArea}
              multiline
              numberOfLines={4}
              maxLength={100}
              textAlignVertical="top"
            />
            <Text style={styles.textAreaCounter}>{description.length}/100</Text>
          </View>
        </View>

        {/* Configuración */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications-active" size={20} color="#FFD54F" />
              <Text style={styles.settingLabel}>Activada al guardar</Text>
            </View>
            <View style={styles.settingBadge}>
              <Text style={styles.settingBadgeText}>SIEMPRE</Text>
            </View>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="repeat" size={20} color="#FFD54F" />
              <Text style={styles.settingLabel}>Repetición diaria</Text>
            </View>
            <View style={styles.settingBadge}>
              <Text style={styles.settingBadgeText}>DIARIO</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Botón de Guardar */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[
            styles.saveButton,
            !date && styles.saveButtonDisabled
          ]} 
          onPress={saveAlarm}
          disabled={!date}
        >
          <Text style={styles.saveButtonText}>Guardar Alarma</Text>
          <Ionicons name="checkmark-circle" size={20} color="#121212" />
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={showPicker}
        mode="time"
        onConfirm={(d) => {
          setDate(d);
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
        themeVariant="dark"
        isDarkModeEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    color: "#FFF8E1",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: 'Montserrat_700Bold',
  },
  stepIndicator: {
    backgroundColor: "#1E1E1E",
    color: "#FFD54F",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  sectionTitle: {
    color: "#FFD54F",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionDescription: {
    color: "#888888",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  timeSelector: {
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333333",
    marginBottom: 15,
  },
  timeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 213, 79, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  timeValue: {
    color: "#FFF8E1",
    fontSize: 20,
    fontWeight: "700",
  },
  timeTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 213, 79, 0.05)",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD54F",
  },
  timeTipText: {
    color: "#FFF8E1",
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    backgroundColor: "#121212",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333333",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#FFF8E1",
    fontSize: 16,
    paddingVertical: 16,
    fontFamily: 'Poppins_400Regular',
  },
  charCounter: {
    color: "#888888",
    fontSize: 12,
    marginLeft: 10,
  },
  textAreaContainer: {
    backgroundColor: "#121212",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333333",
  },
  textAreaIcon: {
    position: "absolute",
    top: 16,
    left: 15,
  },
  textArea: {
    color: "#FFF8E1",
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 45,
    fontFamily: 'Poppins_400Regular',
    minHeight: 120,
  },
  textAreaCounter: {
    color: "#888888",
    fontSize: 12,
    textAlign: "right",
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    color: "#FFF8E1",
    fontSize: 16,
    fontWeight: "500",
  },
  settingBadge: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  settingBadgeText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "700",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#121212",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#1E1E1E",
  },
  saveButton: {
    backgroundColor: "#FFD54F",
    borderRadius: 50,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveButtonDisabled: {
    backgroundColor: "#333333",
  },
  saveButtonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: 'Poppins_600SemiBold',
  },
});