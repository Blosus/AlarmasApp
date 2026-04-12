import {
    DIET_THEORETICAL_MAX_CALORIES,
    DietDailyHistoryItem,
} from "@/services/diet-daily";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  items: DietDailyHistoryItem[];
  recommendedCalories: number;
  colors?: any;
};

const weekdayShort = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const CHART_HEIGHT = 168;
const CHART_WIDTH = 308;

const formatDay = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  return weekdayShort[d.getDay()];
};

const formatDelta = (value: number): string => {
  if (value > 0) {
    return `+${Math.round(value)} kcal`;
  }
  if (value < 0) {
    return `${Math.round(value)} kcal`;
  }
  return "0 kcal";
};

const clampCalories = (value: number): number =>
  Math.max(0, Math.min(DIET_THEORETICAL_MAX_CALORIES, value));

export default function CalorieChart({
  items,
  recommendedCalories,
  colors,
}: Props) {
  const count = Math.max(1, items.length);
  const usableWidth = CHART_WIDTH - 24;
  const xStep = count <= 1 ? 0 : usableWidth / (count - 1);
  const topPadding = 8;
  const bottomPadding = 18;
  const plotHeight = CHART_HEIGHT - topPadding - bottomPadding;

  const points = items.map((it, idx) => {
    const x = 12 + idx * xStep;
    const ratio =
      clampCalories(it.caloriesConsumed) / DIET_THEORETICAL_MAX_CALORIES;
    const y = topPadding + (1 - ratio) * plotHeight;
    return {
      ...it,
      x,
      y,
    };
  });

  const targetY =
    topPadding +
    (1 - clampCalories(recommendedCalories) / DIET_THEORETICAL_MAX_CALORIES) *
      plotHeight;

  return (
    <View style={styles.container}>
      <View style={styles.chartShell}>
        <View style={styles.gridLinesWrap}>
          {[0, 2500, 5000, 7500, DIET_THEORETICAL_MAX_CALORIES].map((label) => {
            const y =
              topPadding +
              (1 - label / DIET_THEORETICAL_MAX_CALORIES) * plotHeight;
            return (
              <View key={label} style={[styles.gridLineRow, { top: y }]}>
                <View
                  style={[
                    styles.gridLine,
                    { borderColor: colors?.border ?? "#DDD" },
                  ]}
                />
                <Text
                  style={[
                    styles.gridLabel,
                    { color: colors?.textSecondary ?? "#777" },
                  ]}
                >
                  {label / 1000}k
                </Text>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.targetLine,
            {
              top: targetY,
              borderColor: colors?.accent ?? "#4CAF50",
            },
          ]}
        />

        {points.slice(0, -1).map((point, idx) => {
          const next = points[idx + 1];
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          return (
            <View
              key={`${point.dateKey}-${next.dateKey}`}
              style={[
                styles.segment,
                {
                  width: length,
                  left: point.x,
                  top: point.y,
                  backgroundColor: colors?.accent ?? "#4CAF50",
                  transform: [{ rotateZ: `${angle}rad` }],
                },
              ]}
            />
          );
        })}

        {points.map((point) => (
          <View
            key={point.dateKey}
            style={[
              styles.point,
              {
                left: point.x - 6,
                top: point.y - 6,
                borderColor: colors?.background ?? "#FFF",
                backgroundColor: point.goalMet
                  ? (colors?.accent ?? "#4CAF50")
                  : (colors?.textSecondary ?? "#9E9E9E"),
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.xRow}>
        {items.map((it, idx) => {
          const prev = idx > 0 ? items[idx - 1] : null;
          const delta = prev ? it.caloriesConsumed - prev.caloriesConsumed : 0;
          const deltaColor =
            delta > 0
              ? "#B85C00"
              : delta < 0
                ? "#1976D2"
                : (colors?.textSecondary ?? "#777");

          return (
            <View key={it.dateKey} style={styles.dayCard}>
              <Text
                style={[styles.barLabel, { color: colors?.text ?? "#222" }]}
              >
                {formatDay(it.dateKey)}
              </Text>
              <Text
                style={[styles.valueLabel, { color: colors?.text ?? "#222" }]}
              >
                {Math.round(it.caloriesConsumed)} kcal
              </Text>
              <Text style={[styles.deltaLabel, { color: deltaColor }]}>
                {idx === 0 ? "Inicio" : formatDelta(delta)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <Text
          style={[
            styles.legendText,
            { color: colors?.textSecondary ?? "#666" },
          ]}
        >
          Línea punteada: objetivo diario ({Math.round(recommendedCalories)}{" "}
          kcal)
        </Text>
      </View>
      <View style={styles.legendRow}>
        <Text
          style={[
            styles.legendText,
            { color: colors?.textSecondary ?? "#666" },
          ]}
        >
          Escala teórica: 0 a{" "}
          {DIET_THEORETICAL_MAX_CALORIES.toLocaleString("es-ES")} kcal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingVertical: 8,
  },
  chartShell: {
    width: "100%",
    height: CHART_HEIGHT,
    position: "relative",
    marginBottom: 10,
  },
  gridLinesWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  gridLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  gridLabel: {
    width: 34,
    textAlign: "right",
    fontSize: 10,
    marginLeft: 6,
  },
  targetLine: {
    position: "absolute",
    left: 0,
    right: 34,
    borderTopWidth: 2,
    borderStyle: "dotted",
  },
  segment: {
    position: "absolute",
    height: 2,
    borderRadius: 2,
    transformOrigin: "left center",
  },
  point: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  xRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  valueLabel: {
    fontSize: 11,
    marginTop: 3,
  },
  deltaLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "700",
  },
  legendRow: {
    marginTop: 6,
    alignItems: "flex-start",
  },
  legendText: {
    fontSize: 12,
  },
});
