import { useTheme } from "@/hooks/theme-context";
import {
    FoodCategory,
    FoodItem,
    getFoodDatabase,
} from "@/services/food-database";
import { getCurrentSessionUser } from "@/services/session";
import {
    deleteCustomFood,
    getUserCustomFoods,
} from "@/services/user-custom-foods";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { getIndexStyles } from "./styles/index.styles";

const NUTRITION_CATEGORIES = [
  { key: "ALL", label: "Todas" },
  { key: "verduras", label: "Verduras" },
  { key: "frutas", label: "Frutas" },
  { key: "cereales", label: "Cereales" },
  { key: "grasas", label: "Grasas" },
  { key: "leguminosas", label: "Leguminosas" },
  { key: "lacteos", label: "Lácteos" },
  { key: "chucherias", label: "Chucherías" },
  { key: "custom", label: "Mis alimentos" },
] as const;

type NutritionCategoryFilter = (typeof NUTRITION_CATEGORIES)[number]["key"];

const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  frutas: "Frutas",
  verduras: "Verduras",
  cereales: "Cereales",
  grasas: "Grasas",
  leguminosas: "Leguminosas",
  lacteos: "Lácteos",
  chucherias: "Chucherías",
};

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseGramsInput = (value: string) => {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(3000, Math.round(parsed * 10) / 10);
};

const formatMacroValue = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
};

export default function FoodsScreen() {
  const { colors } = useTheme();
  const styles = getIndexStyles(colors);
  const placeholderColor = "rgba(140, 140, 140, 0.45)";

  const [allFoodItems, setAllFoodItems] = useState<FoodItem[]>([]);
  const [isLoadingFoods, setIsLoadingFoods] = useState(true);
  const [removingCustomFoodId, setRemovingCustomFoodId] = useState<
    string | null
  >(null);
  const [nutritionSearchText, setNutritionSearchText] = useState("");
  const [selectedNutritionCategory, setSelectedNutritionCategory] =
    useState<NutritionCategoryFilter>("ALL");
  const [nutritionGramsById, setNutritionGramsById] = useState<
    Record<string, string>
  >({});

  const loadFoods = useCallback(async () => {
    setIsLoadingFoods(true);
    try {
      const sessionUser = await getCurrentSessionUser();
      const uid = sessionUser?.uid ?? "guest";
      const [dbItems, customItems] = await Promise.all([
        getFoodDatabase(),
        getUserCustomFoods(uid),
      ]);
      setAllFoodItems([...dbItems, ...customItems]);
    } finally {
      setIsLoadingFoods(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFoods();
    }, [loadFoods]),
  );

  const normalizedNutritionSearch = normalizeSearchText(nutritionSearchText);
  const hasNutritionSearch = normalizedNutritionSearch.length > 0;
  const hasCategoryFilter = selectedNutritionCategory !== "ALL";

  const visibleNutritionItems = useMemo(() => {
    let items = allFoodItems;
    if (selectedNutritionCategory === "custom") {
      items = items.filter((item) => item.id.startsWith("custom_"));
    } else if (selectedNutritionCategory !== "ALL") {
      items = items.filter(
        (item) => item.category === selectedNutritionCategory,
      );
    }

    if (hasNutritionSearch) {
      items = items.filter((item) =>
        normalizeSearchText(item.name).includes(normalizedNutritionSearch),
      );
    }

    return items.slice(0, hasNutritionSearch || hasCategoryFilter ? 80 : 30);
  }, [
    allFoodItems,
    hasCategoryFilter,
    hasNutritionSearch,
    normalizedNutritionSearch,
    selectedNutritionCategory,
  ]);

  const handleDeleteCustomFood = async (food: FoodItem) => {
    Alert.alert(
      "Eliminar alimento",
      `¿Seguro que deseas eliminar \"${food.name}\"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const sessionUser = await getCurrentSessionUser();
            const uid = sessionUser?.uid ?? "guest";
            setRemovingCustomFoodId(food.id);
            try {
              await deleteCustomFood(uid, food.id);
              setAllFoodItems((prev) =>
                prev.filter((item) => item.id !== food.id),
              );
              setNutritionGramsById((prev) => {
                const next = { ...prev };
                delete next[food.id];
                return next;
              });
            } finally {
              setRemovingCustomFoodId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.accent} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Alimentos</Text>
          <Text style={styles.stepIndicator}>Base nutricional</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/new-food")}
        >
          <Ionicons name="add-circle" size={30} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dietContent}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Consulta nutricional</Text>
          <Text style={styles.dailyStatusText}>
            Busca alimentos y ajusta los gramos para ver calorías y macros.
          </Text>

          <View style={styles.nutritionActionsRow}>
            <TouchableOpacity
              style={styles.nutritionActionButton}
              onPress={() => router.push("/new-food")}
            >
              <Ionicons name="add" size={16} color={colors.background} />
              <Text style={styles.nutritionActionButtonText}>
                Agregar alimento
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.nutritionSearchRow}>
            <Ionicons name="search" size={18} color={colors.accent} />
            <TextInput
              value={nutritionSearchText}
              onChangeText={setNutritionSearchText}
              placeholder="Ej: pollo, arroz, avena"
              placeholderTextColor={placeholderColor}
              style={styles.nutritionSearchInput}
            />
          </View>

          <View style={styles.nutritionCategoriesRow}>
            {NUTRITION_CATEGORIES.map((category) => {
              const isSelected = selectedNutritionCategory === category.key;
              return (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.nutritionCategoryChip,
                    isSelected && styles.nutritionCategoryChipActive,
                  ]}
                  onPress={() => setSelectedNutritionCategory(category.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.nutritionCategoryText,
                      isSelected && styles.nutritionCategoryTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isLoadingFoods ? (
            <View style={styles.nutritionEmptyState}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.nutritionEmptyTitle}>
                Cargando alimentos...
              </Text>
            </View>
          ) : visibleNutritionItems.length === 0 ? (
            <View style={styles.nutritionEmptyState}>
              <Text style={styles.nutritionEmptyTitle}>
                Sin resultados para esta búsqueda
              </Text>
            </View>
          ) : (
            <View style={styles.nutritionList}>
              {visibleNutritionItems.map((item) => {
                const typedGramsText =
                  nutritionGramsById[item.id] ??
                  String(item.portion?.gramos ?? 100);
                const gramsValue =
                  parseGramsInput(typedGramsText) ??
                  item.portion?.gramos ??
                  100;
                const factor = gramsValue / 100;
                const caloriesValue = Math.round(item.kcal * factor);
                const proteinValue =
                  Math.round(item.protein * factor * 10) / 10;
                const fatsValue = Math.round(item.fats * factor * 10) / 10;
                const carbsValue = Math.round(item.carbs * factor * 10) / 10;
                const referenceLabel = item.portion
                  ? `${item.portion.cantidad} ${item.portion.unidad} (${item.portion.gramos} g)`
                  : "100 g";
                const isCustom = item.id.startsWith("custom_");

                return (
                  <View key={item.id} style={styles.nutritionCard}>
                    <View style={styles.nutritionCardHeader}>
                      <View style={styles.nutritionCardTitleBlock}>
                        <Text style={styles.nutritionFoodName}>
                          {item.name}
                        </Text>
                        <Text style={styles.nutritionServingText}>
                          {FOOD_CATEGORY_LABELS[item.category]} • Ref:{" "}
                          {referenceLabel}
                        </Text>
                      </View>
                      <View style={styles.nutritionCaloriesBadge}>
                        <Text style={styles.nutritionCaloriesValue}>
                          {caloriesValue}
                        </Text>
                        <Text style={styles.nutritionCaloriesLabel}>kcal</Text>
                      </View>
                    </View>

                    {isCustom && (
                      <TouchableOpacity
                        style={styles.nutritionDeleteButton}
                        onPress={() => handleDeleteCustomFood(item)}
                        disabled={removingCustomFoodId === item.id}
                      >
                        {removingCustomFoodId === item.id ? (
                          <ActivityIndicator size="small" color="#B33A3A" />
                        ) : (
                          <>
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color="#B33A3A"
                            />
                            <Text style={styles.nutritionDeleteButtonText}>
                              Eliminar
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    <View style={styles.nutritionGramsRow}>
                      <Text style={styles.nutritionGramsLabel}>Cantidad</Text>
                      <View style={styles.nutritionGramsInputWrap}>
                        <TextInput
                          value={typedGramsText}
                          onChangeText={(value) =>
                            setNutritionGramsById((prev) => ({
                              ...prev,
                              [item.id]: value,
                            }))
                          }
                          keyboardType="decimal-pad"
                          style={styles.nutritionGramsInput}
                          placeholder={String(item.portion?.gramos ?? 100)}
                          placeholderTextColor={placeholderColor}
                        />
                        <Text style={styles.nutritionGramsSuffix}>g</Text>
                      </View>
                    </View>

                    <View style={styles.nutritionMacrosRow}>
                      <View style={styles.nutritionMacroChip}>
                        <Text style={styles.nutritionMacroLabel}>Proteína</Text>
                        <Text style={styles.nutritionMacroValue}>
                          {formatMacroValue(proteinValue)} g
                        </Text>
                      </View>
                      <View style={styles.nutritionMacroChip}>
                        <Text style={styles.nutritionMacroLabel}>Grasas</Text>
                        <Text style={styles.nutritionMacroValue}>
                          {formatMacroValue(fatsValue)} g
                        </Text>
                      </View>
                      <View style={styles.nutritionMacroChip}>
                        <Text style={styles.nutritionMacroLabel}>Carbs</Text>
                        <Text style={styles.nutritionMacroValue}>
                          {formatMacroValue(carbsValue)} g
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
