import CalorieChart from "@/components/calorie-chart";
import { useTheme } from "@/hooks/theme-context";
import {
  Alarm,
  cancelAlarmNotifications,
  getAlarmWeekdaysSummary,
  loadUserAlarms,
  readCachedAlarms,
  saveUserAlarms,
  scheduleAlarmNotifications,
} from "@/services/alarms";
import {
  addTodayDietMealEntry,
  DIET_THEORETICAL_MAX_CALORIES,
  DietDailyHistoryItem,
  DietDailyLog,
  DietStreakSummary,
  loadRecentDietHistory,
  loadTodayDietTracking,
} from "@/services/diet-daily";
import { getCurrentSessionUser } from "@/services/session";
import {
  DietProfile,
  getExistingUserDietProfile,
  isDietProfileComplete,
} from "@/services/user-diet-profile";
import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getIndexStyles } from "../styles/index.styles";

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const styles = getIndexStyles(colors);
  const placeholderColor = "rgba(140, 140, 140, 0.45)";
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [ownerUid, setOwnerUid] = useState("guest");
  const [isLoadingAlarms, setIsLoadingAlarms] = useState(true);
  const [activeTab, setActiveTab] = useState<"alarms" | "diet">("alarms");
  const [dietSetupCompleted, setDietSetupCompleted] = useState(false);
  const [dietProfile, setDietProfile] = useState<DietProfile | null>(null);
  const [dietTodayLog, setDietTodayLog] = useState<DietDailyLog | null>(null);
  const [dietRecentHistory, setDietRecentHistory] = useState<
    DietDailyHistoryItem[]
  >([]);
  const [dietStreak, setDietStreak] = useState<DietStreakSummary>({
    currentStreak: 0,
    bestStreak: 0,
    completedDays: 0,
  });
  const [mealCaloriesText, setMealCaloriesText] = useState("");
  const [mealProteinText, setMealProteinText] = useState("");
  const [mealCarbsText, setMealCarbsText] = useState("");
  const [mealFatsText, setMealFatsText] = useState("");
  const [isSavingDietProgress, setIsSavingDietProgress] = useState(false);
  const [isLoadingDietStatus, setIsLoadingDietStatus] = useState(true);
  const [showMealAlarmLog, setShowMealAlarmLog] = useState(false);
  const latestLoadRequestRef = useRef(0);
  const mealAlarmNames = new Set([
    "Desayuno",
    "Media Mañana",
    "Almuerzo",
    "Media Tarde",
    "Cena",
  ]);

  const buildDietInsights = (profile: DietProfile | null) => {
    if (
      !isDietProfileComplete(profile) ||
      profile?.weightKg == null ||
      profile.heightCm == null ||
      profile.goal == null ||
      profile.age == null ||
      profile.gender == null
    ) {
      return null;
    }

    const heightM = profile.heightCm / 100;
    if (!Number.isFinite(heightM) || heightM <= 0) {
      return null;
    }

    const bmi = profile.weightKg / (heightM * heightM);

    let bmiCategory = "Peso normal";
    if (bmi < 18.5) {
      bmiCategory = "Bajo peso";
    } else if (bmi >= 25 && bmi < 30) {
      bmiCategory = "Sobrepeso";
    } else if (bmi >= 30) {
      bmiCategory = "Obesidad";
    }

    const healthyMinWeight = 18.5 * heightM * heightM;
    const healthyMaxWeight = 24.9 * heightM * heightM;
    const bmr =
      profile.gender === "MALE"
        ? 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
        : 10 * profile.weightKg +
          6.25 * profile.heightCm -
          5 * profile.age -
          161;
    const activityMultiplier =
      profile.activityLevel === "LIGHT"
        ? 1.375
        : profile.activityLevel === "MODERATE"
          ? 1.55
          : profile.activityLevel === "ACTIVE"
            ? 1.725
            : profile.activityLevel === "EXTREME"
              ? 1.9
              : 1.2; // default SEDENTARY
    const maintenanceCalories = Math.round(bmr * activityMultiplier);
    const deficit = bmi >= 30 ? 500 : bmi >= 25 ? 400 : 300;
    const recommendedCalories =
      profile.goal === "LOSE_WEIGHT"
        ? Math.round(Math.max(1200, maintenanceCalories - deficit))
        : maintenanceCalories;

    const goalLabel =
      profile.goal === "LOSE_WEIGHT" ? "Bajar peso" : "Mantener peso saludable";
    const genderLabel = profile.gender === "MALE" ? "Hombre" : "Mujer";
    const recommendationText =
      profile.goal === "LOSE_WEIGHT"
        ? `Tu objetivo actual es perder peso, por eso la recomendación usa un déficit de ${deficit} kcal sobre tu mantenimiento estimado a partir de peso, altura, edad y género.`
        : "Tu objetivo actual es mantener un peso saludable; por eso la recomendación muestra tus calorías estimadas de mantenimiento según peso, altura, edad y género.";

    return {
      bmi,
      bmiCategory,
      healthyMinWeight,
      healthyMaxWeight,
      maintenanceCalories,
      recommendedCalories,
      goalLabel,
      genderLabel,
      recommendationText,
    };
  };

  const loadAlarms = async () => {
    const requestId = latestLoadRequestRef.current + 1;
    latestLoadRequestRef.current = requestId;

    const sessionUser = await getCurrentSessionUser();
    const uid = sessionUser?.uid ?? "guest";

    // Fase 1: mostrar datos cacheados inmediatamente desde AsyncStorage
    const cached = await readCachedAlarms(uid);
    if (requestId === latestLoadRequestRef.current) {
      setOwnerUid(uid);
      setAlarms(cached);
      if (cached.length > 0) {
        setIsLoadingAlarms(false);
      }
    }

    // Fase 2: sync con la nube en segundo plano, actualizar silenciosamente
    const loaded = await loadUserAlarms(uid);
    if (requestId !== latestLoadRequestRef.current) return;

    setOwnerUid(uid);
    setAlarms(loaded);
    setIsLoadingAlarms(false);
  };

  const loadDietStatus = async () => {
    const sessionUser = await getCurrentSessionUser();
    const uid = sessionUser?.uid ?? "guest";
    const profile = await getExistingUserDietProfile(uid);
    const completed = isDietProfileComplete(profile);

    const insights = completed ? buildDietInsights(profile) : null;

    if (completed && insights) {
      const tracking = await loadTodayDietTracking(
        uid,
        insights.recommendedCalories,
      );
      const recentHistory = await loadRecentDietHistory(
        uid,
        insights.recommendedCalories,
        7,
      );
      setDietTodayLog(tracking.today);
      setDietRecentHistory(recentHistory);
      setDietStreak(tracking.streak);
    } else {
      setDietTodayLog(null);
      setDietRecentHistory([]);
      setDietStreak({ currentStreak: 0, bestStreak: 0, completedDays: 0 });
    }

    setDietProfile(completed ? profile : null);
    setDietSetupCompleted(completed);
    setIsLoadingDietStatus(false);
  };

  useFocusEffect(
    useCallback(() => {
      void loadAlarms();
      void loadDietStatus();
    }, []),
  );

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    (async () => {
      try {
        await Notifications.setNotificationChannelAsync("alarm-channel", {
          name: "Alarm Channel",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          vibrationPattern: [0, 500, 200, 500],
          lightColor: "#FF0000",
        });
      } catch (e) {
        // ignore if not Android or not supported
      }
    })();

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const alarmId = response.notification.request.content.data?.alarmId;
        if (alarmId) {
          router.push({
            pathname: "/alarmScreen",
            params: { id: String(alarmId) },
          });
        }
      });

    const receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const alarmId = notification.request.content.data?.alarmId;
        if (alarmId) {
          router.push({
            pathname: "/alarmScreen",
            params: { id: String(alarmId) },
          });
        }
      },
    );

    return () => {
      responseListener.remove();
      receivedListener.remove();
    };
  }, []);

  const toggleAlarm = async (alarm: Alarm) => {
    let updatedAlarm = { ...alarm, enabled: !alarm.enabled };

    await cancelAlarmNotifications(alarm);
    updatedAlarm.notifId = undefined;
    updatedAlarm.notifIds = undefined;

    if (updatedAlarm.enabled) {
      const scheduled = await scheduleAlarmNotifications({
        id: updatedAlarm.id,
        hour: updatedAlarm.hour,
        minute: updatedAlarm.minute,
        name: updatedAlarm.name,
        description: updatedAlarm.description,
        weekdays: updatedAlarm.weekdays,
      });
      updatedAlarm.notifId = scheduled.notifId;
      updatedAlarm.notifIds = scheduled.notifIds;
    } else {
      updatedAlarm.notifId = undefined;
      updatedAlarm.notifIds = undefined;
    }

    const updatedAlarms = alarms.map((a) =>
      a.id === alarm.id ? updatedAlarm : a,
    );
    setAlarms(updatedAlarms);
    await saveUserAlarms(ownerUid, updatedAlarms);
  };

  const removeAlarm = async (alarm: Alarm) => {
    await cancelAlarmNotifications(alarm);
    const next = alarms.filter((a) => a.id !== alarm.id);
    setAlarms(next);
    await saveUserAlarms(ownerUid, next);
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
  };

  const getTotalAlarms = () => alarms.length;
  const getActiveAlarms = () => alarms.filter((a) => a.enabled).length;
  const isDietMealAlarm = (alarm: Alarm) => {
    return (
      alarm.description === "Alarma de comida" || mealAlarmNames.has(alarm.name)
    );
  };
  const dietInsights = buildDietInsights(dietProfile);

  const parseDecimalInput = (value: string): number | null => {
    const parsed = Number(value.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.round(parsed * 10) / 10;
  };

  const formatExactValue = (value: number): string => {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(1);
  };

  const handleAddMealEntry = async () => {
    if (!dietInsights) {
      Alert.alert(
        "Perfil incompleto",
        "Completa tu perfil de dieta antes de registrar comidas.",
      );
      return;
    }

    const sessionUser = await getCurrentSessionUser();
    const uid = sessionUser?.uid ?? "guest";

    const calories = parseDecimalInput(mealCaloriesText);
    const protein = mealProteinText.trim().length
      ? parseDecimalInput(mealProteinText)
      : 0;
    const carbs = mealCarbsText.trim().length
      ? parseDecimalInput(mealCarbsText)
      : 0;
    const fats = mealFatsText.trim().length
      ? parseDecimalInput(mealFatsText)
      : 0;

    if (calories == null || calories <= 0) {
      Alert.alert(
        "Calorías inválidas",
        "Ingresa las calorías de esta comida con un valor mayor a 0.",
      );
      return;
    }

    if (protein == null || carbs == null || fats == null) {
      Alert.alert(
        "Macros inválidos",
        "Si agregas proteínas, carbs o grasas, usa valores numéricos válidos (0 o mayores).",
      );
      return;
    }

    const currentCalories = dietTodayLog?.caloriesConsumed ?? 0;
    const remainingToCap = Math.max(
      0,
      DIET_THEORETICAL_MAX_CALORIES - currentCalories,
    );

    if (remainingToCap <= 0) {
      Alert.alert(
        "Límite teórico alcanzado",
        `Hoy ya alcanzaste el límite teórico de ${DIET_THEORETICAL_MAX_CALORIES.toLocaleString("es-ES")} kcal.`,
      );
      return;
    }

    setIsSavingDietProgress(true);
    try {
      const saved = await addTodayDietMealEntry(
        uid,
        {
          calories,
          protein,
          carbs,
          fats,
        },
        dietInsights.recommendedCalories,
      );

      setDietTodayLog(saved.today);
      setDietStreak(saved.streak);
      setMealCaloriesText("");
      setMealProteinText("");
      setMealCarbsText("");
      setMealFatsText("");

      if (calories > remainingToCap) {
        Alert.alert(
          "Entrada ajustada",
          `Se registró hasta el límite teórico diario de ${DIET_THEORETICAL_MAX_CALORIES.toLocaleString("es-ES")} kcal.`,
        );
      }

      const recentHistory = await loadRecentDietHistory(
        uid,
        dietInsights.recommendedCalories,
        7,
      );
      setDietRecentHistory(recentHistory);
    } finally {
      setIsSavingDietProgress(false);
    }
  };

  const showCaloriesHelp = () => {
    Alert.alert(
      "Ayuda calorias",
      "Registra las calorías de cada comida y presiona 'Agregar comida'. El total del día se va acumulando automáticamente.",
    );
  };

  const renderDietSummary = () => {
    if (!dietProfile || !dietInsights) {
      return renderOnboardingDiet();
    }

    const goalReachedToday = Boolean(dietTodayLog?.goalMet);
    const mealAlarms = alarms.filter(isDietMealAlarm);
    const activeMealAlarms = mealAlarms.filter((alarm) => alarm.enabled);
    const inactiveMealAlarms = mealAlarms.filter((alarm) => !alarm.enabled);

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dietContent}
      >
        <View style={styles.dietHeroCard}>
          <View style={styles.dietHeroBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={styles.dietHeroBadgeText}>Perfil completo</Text>
          </View>

          <Text style={styles.dietHeroTitle}>
            Resumen de tu plan nutricional
          </Text>
          <Text style={styles.dietHeroText}>
            Tus recomendaciones se calcularon usando tu peso, altura y objetivo
            guardado en esta cuenta.
          </Text>
        </View>

        <View style={styles.dietMetricsRow}>
          <View style={styles.dietMetricCard}>
            <Text style={styles.dietMetricLabel}>IMC</Text>
            <Text style={styles.dietMetricValue}>
              {dietInsights.bmi.toFixed(1)}
            </Text>
            <Text style={styles.dietMetricHint}>
              {dietInsights.bmiCategory}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.dietMetricCard}
            activeOpacity={0.85}
            onPress={() => setShowMealAlarmLog((prev) => !prev)}
          >
            <Text style={styles.dietMetricLabel}>Objetivo</Text>
            <Text style={styles.dietMetricValueSmall}>
              {dietInsights.goalLabel}
            </Text>
            <Text style={styles.dietMetricHint}>
              {activeMealAlarms.length} horarios activos
            </Text>
            <View style={styles.metricActionRow}>
              <Text style={styles.metricActionText}>
                {showMealAlarmLog ? "Ocultar registro" : "Ver registro"}
              </Text>
              <Ionicons
                name={showMealAlarmLog ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.accent}
              />
            </View>
          </TouchableOpacity>
        </View>

        {showMealAlarmLog && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Registro de horarios de comida
            </Text>
            <Text style={styles.dailyStatusText}>
              Este registro usa tus alarmas creadas por el plan de dieta y
              muestra cuáles siguen activas y cuáles fueron desactivadas.
            </Text>

            {mealAlarms.length === 0 ? (
              <Text style={styles.emptyMealLogText}>
                Aún no hay alarmas de comida registradas.
              </Text>
            ) : (
              <View style={styles.mealLogList}>
                {mealAlarms.map((alarm) => (
                  <View key={String(alarm.id)} style={styles.mealLogRow}>
                    <View style={styles.mealLogInfo}>
                      <Text style={styles.mealLogTitle}>
                        {alarm.name} - {formatTime(alarm.hour, alarm.minute)}
                      </Text>
                      <Text style={styles.mealLogDays}>
                        {getAlarmWeekdaysSummary(alarm.weekdays)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.mealLogStatus,
                        alarm.enabled
                          ? styles.mealLogStatusActive
                          : styles.mealLogStatusInactive,
                      ]}
                    >
                      <Text style={styles.mealLogStatusText}>
                        {alarm.enabled ? "Activa" : "Desactivada"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {inactiveMealAlarms.length > 0 && (
              <Text style={styles.mealLogFootnote}>
                {inactiveMealAlarms.length} horario(s) están desactivados.
              </Text>
            )}
          </View>
        )}

        <View style={styles.streakCard}>
          <View style={styles.streakInfo}>
            <View style={styles.streakIcon}>
              <Ionicons name="flame" size={26} color={colors.accent} />
            </View>
            <View>
              <Text style={styles.streakLabel}>Racha diaria</Text>
              <Text style={styles.streakValue}>{dietStreak.currentStreak}</Text>
            </View>
          </View>

          <View>
            <Text style={styles.streakLabel}>Mejor racha</Text>
            <Text style={styles.streakValue}>{dietStreak.bestStreak}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Calorías recomendadas</Text>
          <Text style={styles.caloriesValue}>
            {dietInsights.recommendedCalories} kcal
          </Text>
          <Text style={styles.caloriesCaption}>
            Recomendación diaria estimada
          </Text>
          <Text style={styles.caloriesDescription}>
            {dietInsights.recommendationText}
          </Text>

          <View style={styles.caloriesBreakdownRow}>
            <View style={styles.caloriesBreakdownCard}>
              <Text style={styles.caloriesBreakdownLabel}>Mantenimiento</Text>
              <Text style={styles.caloriesBreakdownValue}>
                {dietInsights.maintenanceCalories} kcal
              </Text>
            </View>

            <View style={styles.caloriesBreakdownCard}>
              <Text style={styles.caloriesBreakdownLabel}>Objetivo actual</Text>
              <Text style={styles.caloriesBreakdownValue}>
                {dietInsights.recommendedCalories} kcal
              </Text>
            </View>
          </View>

          {/* Macros: Carbs / Protein / Fats */}
          <View style={styles.macrosRow}>
            <View style={[styles.macroCard, styles.macroCarbsCard]}>
              <Text style={styles.macroLabel}>Carbohidratos</Text>
              <Text style={[styles.macroValue, styles.macroCarbsValue]}>
                {dietProfile?.carbsGrams ?? "-"} g
              </Text>
            </View>

            <View style={[styles.macroCard, styles.macroProteinCard]}>
              <Text style={styles.macroLabel}>Proteínas</Text>
              <Text style={[styles.macroValue, styles.macroProteinValue]}>
                {dietProfile?.proteinGrams ?? "-"} g
              </Text>
            </View>

            <View style={[styles.macroCard, styles.macroFatsCard]}>
              <Text style={styles.macroLabel}>Grasas</Text>
              <Text style={[styles.macroValue, styles.macroFatsValue]}>
                {dietProfile?.fatsGrams ?? "-"} g
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Alimentos</Text>
          <Text style={styles.dailyStatusText}>
            Informate mejor sobre los alimentos que consumes y organizalos de
            una manera adecuada para ti.
          </Text>
          <TouchableOpacity
            style={styles.dietEditButton}
            onPress={() => router.push("/foods")}
          >
            <Text style={styles.dietEditButtonText}>
              Abrir ventana de alimentos
            </Text>
            <Ionicons
              name="restaurant-outline"
              size={16}
              color={colors.background}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Seguimiento de hoy</Text>
          <Text style={styles.dailyStatusText}>
            Meta del día: {dietInsights.recommendedCalories} kcal y al menos 3
            comidas. Puedes registrar calorías por encima de tu objetivo, dentro
            de un marco teórico de{" "}
            {DIET_THEORETICAL_MAX_CALORIES.toLocaleString("es-ES")} kcal.
          </Text>

          <View style={styles.dailyStatusBadgePending}>
            <View style={styles.dietDetailRow}>
              <Text style={styles.dietDetailLabel}>
                Calorías consumidas hoy
              </Text>
              <Text style={styles.dietDetailValue}>
                {formatExactValue(dietTodayLog?.caloriesConsumed ?? 0)} kcal
              </Text>
            </View>
            <View style={styles.dietDetailRow}>
              <Text style={styles.dietDetailLabel}>Comidas registradas</Text>
              <Text style={styles.dietDetailValue}>
                {dietTodayLog?.mealsCount ?? 0}
              </Text>
            </View>
            <View style={styles.dietDetailRow}>
              <Text style={styles.dietDetailLabel}>
                Balance contra objetivo
              </Text>
              <Text style={styles.dietDetailValue}>
                {formatExactValue(
                  (dietTodayLog?.caloriesConsumed ?? 0) -
                    dietInsights.recommendedCalories,
                )}{" "}
                kcal
              </Text>
            </View>
          </View>

          <View style={styles.dailyInputGroup}>
            <View style={styles.dailyLabelRow}>
              <Text style={styles.dailyInputLabel}>
                Calorías de esta comida
              </Text>
              <TouchableOpacity
                style={styles.helpIconButton}
                onPress={showCaloriesHelp}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color={colors.accent}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dailyInputRow}>
              <Ionicons name="flame-outline" size={18} color={colors.accent} />
              <TextInput
                value={mealCaloriesText}
                onChangeText={setMealCaloriesText}
                keyboardType="decimal-pad"
                style={styles.dailyInput}
                placeholder="0"
                placeholderTextColor={placeholderColor}
              />
              <Text style={styles.dailyInputSuffix}>kcal</Text>
            </View>
          </View>

          <Text style={styles.dailyInputLabel}>
            Macros opcionales de esta comida
          </Text>
          <View style={styles.customFoodGridRow}>
            <TextInput
              value={mealProteinText}
              onChangeText={setMealProteinText}
              keyboardType="decimal-pad"
              style={styles.customFoodInputHalf}
              placeholder="Proteína (g)"
              placeholderTextColor={placeholderColor}
            />
            <TextInput
              value={mealCarbsText}
              onChangeText={setMealCarbsText}
              keyboardType="decimal-pad"
              style={styles.customFoodInputHalf}
              placeholder="Carbs (g)"
              placeholderTextColor={placeholderColor}
            />
          </View>
          <View style={[styles.customFoodGridRow, { marginTop: 8 }]}>
            <TextInput
              value={mealFatsText}
              onChangeText={setMealFatsText}
              keyboardType="decimal-pad"
              style={styles.customFoodInputHalf}
              placeholder="Grasas (g)"
              placeholderTextColor={placeholderColor}
            />
          </View>

          <View
            style={[styles.dailyStatusBadge, styles.dailyStatusBadgePending]}
          >
            <Ionicons
              name="analytics-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.dailyStatusBadgeText}>
              Totales macro hoy: P{" "}
              {formatExactValue(dietTodayLog?.proteinConsumed ?? 0)} g • C{" "}
              {formatExactValue(dietTodayLog?.carbsConsumed ?? 0)} g • G{" "}
              {formatExactValue(dietTodayLog?.fatsConsumed ?? 0)} g
            </Text>
          </View>

          <View
            style={[
              styles.dailyStatusBadge,
              goalReachedToday
                ? styles.dailyStatusBadgeSuccess
                : styles.dailyStatusBadgePending,
            ]}
          >
            <Ionicons
              name={goalReachedToday ? "checkmark-circle" : "time-outline"}
              size={18}
              color={goalReachedToday ? "#4CAF50" : colors.textSecondary}
            />
            <Text style={styles.dailyStatusBadgeText}>
              {goalReachedToday
                ? "Objetivo diario completado: se suma +1 a tu racha"
                : "Aún no cumples la meta diaria"}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.dietEditButton,
              isSavingDietProgress && { opacity: 0.6 },
            ]}
            onPress={handleAddMealEntry}
            disabled={isSavingDietProgress}
          >
            <Text style={styles.dietEditButtonText}>Agregar comida al día</Text>
            <Feather name="plus" size={16} color={colors.background} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Clasificación de peso</Text>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Categoría IMC</Text>
            <Text style={styles.dietDetailValue}>
              {dietInsights.bmiCategory}
            </Text>
          </View>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Peso actual</Text>
            <Text style={styles.dietDetailValue}>
              {dietProfile.weightKg ?? "-"} kg /{" "}
              {dietProfile.weightKg
                ? (dietProfile.weightKg * 2.20462).toFixed(1)
                : "-"}{" "}
              lbs
            </Text>
          </View>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Altura</Text>
            <Text style={styles.dietDetailValue}>
              {dietProfile.heightCm} cm
            </Text>
          </View>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Edad</Text>
            <Text style={styles.dietDetailValue}>{dietProfile.age} años</Text>
          </View>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Género</Text>
            <Text style={styles.dietDetailValue}>
              {dietInsights.genderLabel}
            </Text>
          </View>
          <View style={styles.dietDetailRow}>
            <Text style={styles.dietDetailLabel}>Rango de peso normal</Text>
            <Text style={styles.dietDetailValue}>
              {dietInsights.healthyMinWeight.toFixed(1)} -{" "}
              {dietInsights.healthyMaxWeight.toFixed(1)} kg
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Historial últimos 7 días</Text>
          <CalorieChart
            items={dietRecentHistory}
            recommendedCalories={dietInsights.recommendedCalories}
            colors={colors}
          />
        </View>

        <TouchableOpacity
          style={styles.dietEditButton}
          onPress={() =>
            router.push({
              pathname: "/diet-setup",
              params: { startStep: "1" },
            } as never)
          }
        >
          <Text style={styles.dietEditButtonText}>
            Editar información de dieta
          </Text>
          <Feather name="edit-2" size={16} color={colors.background} />
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderOnboardingDiet = () => (
    <View style={styles.onboardingContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", width: "100%" }}
      >
        <View style={styles.onboardingContent}>
          {/* Logo */}
          <View style={styles.onboardingLogo}>
            <FontAwesome5
              name="apple-alt"
              size={60}
              color={colors.background}
            />
          </View>

          {/* Título */}
          <Text style={styles.onboardingTitle}>NutriPlan</Text>
          <Text style={styles.onboardingSubtitle}>
            Tu asistente personal para una vida más saludable
          </Text>

          {/* Caja de bienvenida */}
          <View style={styles.onboardingBox}>
            <Text style={styles.onboardingBoxGreeting}>¡Hola!</Text>
            <Text style={styles.onboardingBoxText}>
              Vamos a crear un plan nutricional personalizado según tus
              objetivos y preferencias.
            </Text>
          </View>

          {/* Botón Comenzar */}
          <TouchableOpacity
            style={styles.onboardingStartButton}
            onPress={() => router.push("/diet-setup" as never)}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={styles.onboardingStartButtonText}>
                {dietSetupCompleted ? "Editar plan" : "Comenzar"}
              </Text>
              <Feather name="arrow-right" size={16} color={colors.background} />
            </View>
          </TouchableOpacity>

          {/* Opciones */}
          <View style={styles.onboardingOptions}>
            <View style={styles.onboardingOption}>
              <View style={styles.onboardingOptionIcon}>
                <FontAwesome5 name="weight" size={20} color={colors.accent} />
              </View>
              <Text style={styles.onboardingOptionLabel}>
                Control de{"\n"}peso
              </Text>
            </View>

            <View style={styles.onboardingOption}>
              <View style={styles.onboardingOptionIcon}>
                <Ionicons name="time" size={20} color={colors.accent} />
              </View>
              <Text style={styles.onboardingOptionLabel}>
                Planificación{"\n"}de horarios
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/(tabs)/ajustes")}
        >
          <Ionicons name="cog" size={24} color={colors.accent} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeTab === "alarms" ? "Mis Alarmas" : "Mi Plan de Dieta"}
          </Text>
          <Text style={styles.stepIndicator}>
            {activeTab === "alarms"
              ? `${getTotalAlarms()} alarmas`
              : dietSetupCompleted
                ? "Perfil completo"
                : "Setup inicial"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            activeTab === "alarms"
              ? router.push("/(tabs)/newAlarm")
              : router.push({
                  pathname: "/diet-setup",
                  params: { startStep: "1" },
                } as never)
          }
        >
          <Ionicons
            name={activeTab === "alarms" ? "add-circle" : "create-outline"}
            size={30}
            color={colors.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Tabs de Navegación */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "alarms" && styles.activeTab]}
          onPress={() => setActiveTab("alarms")}
        >
          <Ionicons
            name="alarm"
            size={20}
            color={activeTab === "alarms" ? "#121212" : colors.text}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "alarms" && styles.activeTabText,
            ]}
          >
            Alarmas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "diet" && styles.activeTab]}
          onPress={() => setActiveTab("diet")}
        >
          <Ionicons
            name="restaurant"
            size={20}
            color={activeTab === "diet" ? "#121212" : colors.text}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "diet" && styles.activeTabText,
            ]}
          >
            Dieta
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenido basado en la pestaña activa */}
      {activeTab === "alarms" ? (
        <>
          {isLoadingAlarms && alarms.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.emptyStateText}>Cargando alarmas...</Text>
            </View>
          ) : (
            <>
              {/* Resumen de Alarmas */}
              <View style={styles.summaryContainer}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIcon, styles.summaryIconActive]}>
                    <MaterialIcons name="alarm" size={20} color="#121212" />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Activas</Text>
                    <Text style={styles.summaryValue}>{getActiveAlarms()}</Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIcon, styles.summaryIconTotal]}>
                    <MaterialIcons name="list" size={20} color="#121212" />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Total</Text>
                    <Text style={styles.summaryValue}>{getTotalAlarms()}</Text>
                  </View>
                </View>
              </View>

              {/* Lista de Alarmas o Empty State */}
              {alarms.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons
                      name="alarm-outline"
                      size={60}
                      color={theme === "dark" ? colors.accent : colors.text}
                    />
                  </View>
                  <Text style={styles.emptyStateTitle}>No hay alarmas</Text>
                  <Text style={styles.emptyStateText}>
                    Presiona el botón + para crear tu primera alarma
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => router.push("/(tabs)/newAlarm")}
                  >
                    <Text style={styles.emptyStateButtonText}>
                      Crear Alarma
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#121212" />
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={alarms}
                  keyExtractor={(item) => String(item.id)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.alarmCard,
                        item.enabled
                          ? styles.alarmCardActive
                          : styles.alarmCardInactive,
                      ]}
                    >
                      {/* Time Section */}
                      <View style={styles.alarmTimeContainer}>
                        <View style={styles.alarmTimeHeader}>
                          <Text
                            style={[
                              styles.alarmTime,
                              item.enabled
                                ? styles.alarmTimeActive
                                : styles.alarmTimeInactive,
                            ]}
                          >
                            {formatTime(item.hour, item.minute)}
                          </Text>
                          <View
                            style={[
                              styles.alarmStatus,
                              item.enabled
                                ? styles.alarmStatusActive
                                : styles.alarmStatusInactive,
                            ]}
                          >
                            <Text style={styles.alarmStatusText}>
                              {item.enabled ? "ACTIVA" : "INACTIVA"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.alarmDetails}>
                          <Text style={styles.alarmName}>{item.name}</Text>
                          <Text style={styles.alarmDaysText}>
                            {getAlarmWeekdaysSummary(item.weekdays)}
                          </Text>
                          {item.description.length > 0 && (
                            <View style={styles.descriptionContainer}>
                              <Ionicons
                                name="document-text-outline"
                                size={14}
                                color="#888888"
                              />
                              <Text style={styles.alarmDescription}>
                                {item.description}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Controles */}
                      <View style={styles.alarmControls}>
                        <View style={styles.switchContainer}>
                          <Text style={styles.switchLabel}>
                            {item.enabled ? "Encendida" : "Apagada"}
                          </Text>
                          <Switch
                            value={item.enabled}
                            onValueChange={() => toggleAlarm(item)}
                            trackColor={{ false: "#333333", true: "#4CAF50" }}
                            thumbColor={item.enabled ? "#FFD54F" : "#FFFFFF"}
                            ios_backgroundColor="#333333"
                          />
                        </View>

                        <TouchableOpacity
                          style={styles.editAlarmButton}
                          onPress={() =>
                            router.push({
                              pathname: "/(tabs)/editAlarma",
                              params: { id: String(item.id) },
                            })
                          }
                        >
                          <Feather
                            name="edit-2"
                            size={18}
                            color={colors.accent}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => {
                            Alert.alert(
                              "Eliminar alarma",
                              "¿Deseas eliminar esta alarma?",
                              [
                                { text: "Cancelar", style: "cancel" },
                                {
                                  text: "Eliminar",
                                  style: "destructive",
                                  onPress: () => removeAlarm(item),
                                },
                              ],
                            );
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#F44336"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </>
          )}
        </>
      ) : isLoadingDietStatus ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.emptyStateText}>
            Cargando tu perfil de dieta...
          </Text>
        </View>
      ) : dietSetupCompleted ? (
        renderDietSummary()
      ) : (
        renderOnboardingDiet()
      )}
    </View>
  );
}
