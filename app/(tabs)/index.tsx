import { Feather, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useState } from "react";
import { Dimensions, FlatList, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { LineChart, ProgressChart } from "react-native-chart-kit";

const { width: screenWidth } = Dimensions.get('window');

type Alarm = {
  id: number;
  hour: number;
  minute: number;
  name: string;
  description: string;
  enabled: boolean;
  notifId?: string;
};

type DietProgress = {
  calories: {
    target: number;
    consumed: number;
  };
  water: {
    target: number;
    consumed: number;
  };
  meals: {
    total: number;
    completed: number;
  };
  streak: number;
  lastUpdated: string;
};

export default function HomeScreen() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeTab, setActiveTab] = useState<'alarms' | 'diet'>('alarms');
  const [dietProgress, setDietProgress] = useState<DietProgress>({
    calories: {
      target: 2000,
      consumed: 1450
    },
    water: {
      target: 2000,
      consumed: 1200
    },
    meals: {
      total: 4,
      completed: 3
    },
    streak: 7,
    lastUpdated: new Date().toLocaleDateString('es-ES')
  });

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

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
  };

  const getTotalAlarms = () => alarms.length;
  const getActiveAlarms = () => alarms.filter(a => a.enabled).length;

  const handleUpdateDiet = (type: 'calories' | 'water' | 'meal', value: number) => {
    setDietProgress(prev => {
      const newProgress = { ...prev };
      if (type === 'calories') {
        newProgress.calories.consumed = Math.max(0, Math.min(newProgress.calories.target, value));
      } else if (type === 'water') {
        newProgress.water.consumed = Math.max(0, Math.min(newProgress.water.target, value));
      } else if (type === 'meal') {
        newProgress.meals.completed = Math.max(0, Math.min(newProgress.meals.total, value));
      }
      newProgress.lastUpdated = new Date().toLocaleDateString('es-ES');
      return newProgress;
    });
  };

  const getCaloriePercentage = () => dietProgress.calories.consumed / dietProgress.calories.target;
  const getWaterPercentage = () => dietProgress.water.consumed / dietProgress.water.target;
  const getMealsPercentage = () => dietProgress.meals.completed / dietProgress.meals.total;

  const calorieData = {
    labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    datasets: [{
      data: [1800, 1950, 1650, 2100, 1750, 1900, dietProgress.calories.consumed],
      color: (opacity = 1) => `rgba(255, 213, 79, ${opacity})`,
      strokeWidth: 3
    }]
  };

  const progressData = {
    labels: ["Calorías", "Agua", "Comidas"],
    data: [getCaloriePercentage(), getWaterPercentage(), getMealsPercentage()]
  };

  const renderDietTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dietContent}>
      {/* Header Dieta */}
      <View style={styles.dietHeader}>
        <View style={styles.dietHeaderTitle}>
          <FontAwesome5 name="apple-alt" size={24} color="#FFD54F" />
          <Text style={styles.dietHeaderText}>Mi Progreso Dietético</Text>
        </View>
        <Text style={styles.dietDate}>Actualizado: {dietProgress.lastUpdated}</Text>
      </View>

      {/* Tarjeta de Racha */}
      <View style={styles.streakCard}>
        <View style={styles.streakInfo}>
          <View style={styles.streakIcon}>
            <FontAwesome5 name="fire" size={24} color="#FFD54F" />
          </View>
          <View>
            <Text style={styles.streakLabel}>Racha Actual</Text>
            <Text style={styles.streakValue}>{dietProgress.streak} días</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editButton}>
          <Feather name="edit-2" size={18} color="#FFF8E1" />
        </TouchableOpacity>
      </View>

      {/* Gráfico de Progreso Circular */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Progreso del Día</Text>
        <View style={styles.progressChartContainer}>
          <ProgressChart
            data={progressData}
            width={screenWidth - 80}
            height={180}
            strokeWidth={12}
            radius={40}
            chartConfig={{
              backgroundColor: "#1E1E1E",
              backgroundGradientFrom: "#1E1E1E",
              backgroundGradientTo: "#1E1E1E",
              decimalPlaces: 0,
              color: (opacity = 1, index) => {
                const colors = [
                  `rgba(255, 213, 79, ${opacity})`, // Calorías - Amarillo
                  `rgba(66, 165, 245, ${opacity})`, // Agua - Azul
                  `rgba(102, 187, 106, ${opacity})`  // Comidas - Verde
                ];
                return colors[index];
              },
              labelColor: () => "#FFF8E1",
              style: {
                borderRadius: 16
              }
            }}
            hideLegend={false}
            style={styles.progressChart}
          />
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: "#FFD54F" }]} />
            <Text style={styles.statLabel}>Calorías</Text>
            <Text style={styles.statValue}>
              {dietProgress.calories.consumed}/{dietProgress.calories.target} kcal
            </Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: "#42A5F5" }]} />
            <Text style={styles.statLabel}>Agua</Text>
            <Text style={styles.statValue}>
              {dietProgress.water.consumed}/{dietProgress.water.target} ml
            </Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: "#66BB6A" }]} />
            <Text style={styles.statLabel}>Comidas</Text>
            <Text style={styles.statValue}>
              {dietProgress.meals.completed}/{dietProgress.meals.total}
            </Text>
          </View>
        </View>
      </View>

      {/* Gráfico de Línea - Semanal */}
      <View style={styles.sectionCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.sectionTitle}>Calorías Consumidas</Text>
          <Text style={styles.chartSubtitle}>Últimos 7 días</Text>
        </View>
        <LineChart
          data={calorieData}
          width={screenWidth - 80}
          height={200}
          chartConfig={{
            backgroundColor: "#1E1E1E",
            backgroundGradientFrom: "#1E1E1E",
            backgroundGradientTo: "#1E1E1E",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 213, 79, ${opacity})`,
            labelColor: () => "#FFF8E1",
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#121212"
            },
            propsForBackgroundLines: {
              strokeDasharray: "",
              stroke: "#333333",
              strokeWidth: 1
            }
          }}
          bezier
          style={styles.lineChart}
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={true}
          withHorizontalLines={true}
          fromZero={false}
        />
        <View style={styles.chartStats}>
          <Text style={styles.chartStat}>
            <Text style={styles.chartStatLabel}>Promedio: </Text>
            <Text style={styles.chartStatValue}>1850 kcal</Text>
          </Text>
          <Text style={styles.chartStat}>
            <Text style={styles.chartStatLabel}>Objetivo: </Text>
            <Text style={styles.chartStatValue}>{dietProgress.calories.target} kcal</Text>
          </Text>
        </View>
      </View>

      {/* Controles Rápidos */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actualizar Progreso</Text>
        <View style={styles.quickControls}>
          <View style={styles.quickControl}>
            <Text style={styles.controlLabel}>Calorías</Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('calories', dietProgress.calories.consumed - 100)}
              >
                <Text style={styles.controlButtonText}>-100</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('calories', dietProgress.calories.consumed + 100)}
              >
                <Text style={styles.controlButtonText}>+100</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.quickControl}>
            <Text style={styles.controlLabel}>Agua (ml)</Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('water', dietProgress.water.consumed - 250)}
              >
                <Text style={styles.controlButtonText}>-250</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('water', dietProgress.water.consumed + 250)}
              >
                <Text style={styles.controlButtonText}>+250</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.quickControl}>
            <Text style={styles.controlLabel}>Comidas</Text>
            <View style={styles.controlButtons}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('meal', dietProgress.meals.completed - 1)}
              >
                <Text style={styles.controlButtonText}>-1</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleUpdateDiet('meal', dietProgress.meals.completed + 1)}
              >
                <Text style={styles.controlButtonText}>+1</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <TouchableOpacity style={styles.detailButton}>
          <Text style={styles.detailButtonText}>Ver Detalles Completos</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFD54F" />
        </TouchableOpacity>
      </View>

      {}
      <View style={styles.tipCard}>
        <View style={styles.tipIcon}>
          <Ionicons name="bulb-outline" size={24} color="#FFD54F" />
        </View>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Consejo del Día</Text>
          <Text style={styles.tipText}>
            Bebe un vaso de agua 30 minutos antes de cada comida para mejorar la digestión y controlar el apetito.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFD54F" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {activeTab === 'alarms' ? 'Mis Alarmas' : 'Mi Progreso'}
          </Text>
          <Text style={styles.stepIndicator}>
            {activeTab === 'alarms' ? `${getTotalAlarms()} alarmas` : 'Hoy'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => activeTab === 'alarms' ? router.push("newAlarm") : null}
        >
          <Ionicons name={activeTab === 'alarms' ? "add-circle" : "refresh"} size={32} color="#FFD54F" />
        </TouchableOpacity>
      </View>

      {/* Tabs de Navegación */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'alarms' && styles.activeTab]} 
          onPress={() => setActiveTab('alarms')}
        >
          <Ionicons 
            name="alarm" 
            size={20} 
            color={activeTab === 'alarms' ? "#121212" : "#FFF8E1"} 
          />
          <Text style={[styles.tabText, activeTab === 'alarms' && styles.activeTabText]}>
            Alarmas
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'diet' && styles.activeTab]} 
          onPress={() => setActiveTab('diet')}
        >
          <Ionicons 
            name="restaurant" 
            size={20} 
            color={activeTab === 'diet' ? "#121212" : "#FFF8E1"} 
          />
          <Text style={[styles.tabText, activeTab === 'diet' && styles.activeTabText]}>
            Dieta
          </Text>
        </TouchableOpacity>
      </View>

      {}
      {activeTab === 'alarms' ? (
        <>
          {}
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

          {}
          {alarms.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="alarm-outline" size={60} color="#FFD54F" />
              </View>
              <Text style={styles.emptyStateTitle}>No hay alarmas</Text>
              <Text style={styles.emptyStateText}>
                Presiona el botón + para crear tu primera alarma
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push("newAlarm")}
              >
                <Text style={styles.emptyStateButtonText}>Crear Alarma</Text>
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
                <View style={[
                  styles.alarmCard,
                  item.enabled ? styles.alarmCardActive : styles.alarmCardInactive
                ]}>
                  {}
                  <View style={styles.alarmTimeContainer}>
                    <View style={styles.alarmTimeHeader}>
                      <Text style={[
                        styles.alarmTime,
                        item.enabled ? styles.alarmTimeActive : styles.alarmTimeInactive
                      ]}>
                        {formatTime(item.hour, item.minute)}
                      </Text>
                      <View style={[
                        styles.alarmStatus,
                        item.enabled ? styles.alarmStatusActive : styles.alarmStatusInactive
                      ]}>
                        <Text style={styles.alarmStatusText}>
                          {item.enabled ? 'ACTIVA' : 'INACTIVA'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.alarmDetails}>
                      <Text style={styles.alarmName}>{item.name}</Text>
                      {item.description.length > 0 && (
                        <View style={styles.descriptionContainer}>
                          <Ionicons name="document-text-outline" size={14} color="#888888" />
                          <Text style={styles.alarmDescription}>{item.description}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Controles */}
                  <View style={styles.alarmControls}>
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>
                        {item.enabled ? 'Encendida' : 'Apagada'}
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
                      style={styles.deleteButton}
                      onPress={() => removeAlarm(item)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </>
      ) : (
        renderDietTab()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
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
    fontSize: 24,
    fontWeight: "700",
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#1E1E1E",
    borderRadius: 50,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 50,
  },
  activeTab: {
    backgroundColor: "#FFD54F",
  },
  tabText: {
    color: "#FFF8E1",
    fontSize: 14,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#121212",
  },
  summaryContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryIconActive: {
    backgroundColor: "#FFD54F",
  },
  summaryIconTotal: {
    backgroundColor: "#4CAF50",
  },
  summaryLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
  },
  summaryValue: {
    color: "#FFF8E1",
    fontSize: 24,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#333333",
  },
  listContent: {
    paddingBottom: 20,
  },
  alarmCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333333",
  },
  alarmCardActive: {
    borderColor: "#FFD54F",
    backgroundColor: "rgba(255, 213, 79, 0.05)",
  },
  alarmCardInactive: {
    borderColor: "#333333",
  },
  alarmTimeContainer: {
    marginBottom: 15,
  },
  alarmTimeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  alarmTime: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  alarmTimeActive: {
    color: "#FFD54F",
  },
  alarmTimeInactive: {
    color: "#888888",
  },
  alarmStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alarmStatusActive: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
  },
  alarmStatusInactive: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
  },
  alarmStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF8E1",
  },
  alarmDetails: {
    gap: 6,
  },
  alarmName: {
    color: "#FFF8E1",
    fontSize: 16,
    fontWeight: "600",
  },
  descriptionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alarmDescription: {
    color: "#888888",
    fontSize: 14,
    flex: 1,
  },
  alarmControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    paddingTop: 15,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchLabel: {
    color: "#FFF8E1",
    fontSize: 14,
    fontWeight: "500",
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  emptyStateTitle: {
    color: "#FFF8E1",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyStateText: {
    color: "#888888",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: "#FFD54F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 50,
  },
  emptyStateButtonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
  },
  // Diet Tab Styles
  dietContent: {
    paddingBottom: 100,
  },
  dietHeader: {
    marginBottom: 20,
  },
  dietHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  dietHeaderText: {
    color: "#FFF8E1",
    fontSize: 20,
    fontWeight: "700",
  },
  dietDate: {
    color: "#888888",
    fontSize: 14,
  },
  streakCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  streakInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  streakIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 213, 79, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  streakLabel: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "500",
  },
  streakValue: {
    color: "#FFD54F",
    fontSize: 28,
    fontWeight: "700",
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
  },
  sectionTitle: {
    color: "#FFD54F",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 15,
  },
  chartHeader: {
    marginBottom: 10,
  },
  chartSubtitle: {
    color: "#888888",
    fontSize: 14,
  },
  progressChartContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  progressChart: {
    borderRadius: 16,
  },
  lineChart: {
    borderRadius: 16,
    marginBottom: 15,
  },
  progressStats: {
    gap: 12,
  },
  progressStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statLabel: {
    color: "#FFF8E1",
    fontSize: 14,
    fontWeight: "500",
    width: 80,
  },
  statValue: {
    color: "#FFF8E1",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  chartStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartStat: {
    color: "#FFF8E1",
    fontSize: 14,
  },
  chartStatLabel: {
    color: "#888888",
  },
  chartStatValue: {
    color: "#FFD54F",
    fontWeight: "600",
  },
  quickControls: {
    gap: 20,
    marginBottom: 20,
  },
  quickControl: {
    gap: 10,
  },
  controlLabel: {
    color: "#FFF8E1",
    fontSize: 16,
    fontWeight: "600",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 12,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "#333333",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444444",
  },
  controlButtonText: {
    color: "#FFF8E1",
    fontSize: 14,
    fontWeight: "600",
  },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "#333333",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444444",
  },
  detailButtonText: {
    color: "#FFD54F",
    fontSize: 16,
    fontWeight: "600",
  },
  tipCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    gap: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 79, 0.1)",
    marginBottom: 20,
  },
  tipIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 213, 79, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    color: "#FFD54F",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 5,
  },
  tipText: {
    color: "#FFF8E1",
    fontSize: 14,
    lineHeight: 20,
  },
});