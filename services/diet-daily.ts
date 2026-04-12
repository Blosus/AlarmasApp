import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type DietDailyLog = {
  dateKey: string;
  caloriesConsumed: number;
  mealsCount: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatsConsumed: number;
  caloriesTarget: number;
  goalMet: boolean;
  updatedAtMs: number;
};

export type DietStreakSummary = {
  currentStreak: number;
  bestStreak: number;
  completedDays: number;
};

export type DietDailyHistoryItem = {
  dateKey: string;
  caloriesConsumed: number;
  caloriesTarget: number;
  mealsCount: number;
  goalMet: boolean;
  isToday: boolean;
};

type DailyLogRecord = Record<string, DietDailyLog>;

const DAILY_STORAGE_KEY_PREFIX = "@diet_daily";
const USERS_COLLECTION = "users";
const DIET_SUBCOLLECTION = "diet";
const DAILY_DOC_PREFIX = "daily_";
export const DIET_THEORETICAL_MAX_CALORIES = 10000;

const buildDailyStorageKey = (uid: string) =>
  `${DAILY_STORAGE_KEY_PREFIX}:${uid}`;

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const dateFromKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const addDays = (key: string, days: number): string => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeDailyLog = (
  input: Partial<DietDailyLog>,
  caloriesTarget: number,
  dateKey: string,
): DietDailyLog => {
  const target = Math.max(0, Math.round(caloriesTarget));
  const consumed = clamp(
    Math.round(Number(input.caloriesConsumed ?? 0) * 10) / 10,
    0,
    DIET_THEORETICAL_MAX_CALORIES,
  );
  const meals = Math.max(0, Math.round(Number(input.mealsCount ?? 0)));
  const proteinConsumed = Math.max(
    0,
    Math.round(Number(input.proteinConsumed ?? 0) * 10) / 10,
  );
  const carbsConsumed = Math.max(
    0,
    Math.round(Number(input.carbsConsumed ?? 0) * 10) / 10,
  );
  const fatsConsumed = Math.max(
    0,
    Math.round(Number(input.fatsConsumed ?? 0) * 10) / 10,
  );
  const goalMet = consumed >= target && meals >= 3;

  return {
    dateKey,
    caloriesConsumed: consumed,
    mealsCount: meals,
    proteinConsumed,
    carbsConsumed,
    fatsConsumed,
    caloriesTarget: target,
    goalMet,
    updatedAtMs: Number(input.updatedAtMs ?? Date.now()),
  };
};

async function canUseCloud(uid: string): Promise<boolean> {
  if (uid === "guest") {
    return false;
  }

  try {
    await auth.authStateReady();
    return auth.currentUser?.uid === uid;
  } catch (error) {
    console.error("Error waiting auth before cloud diet daily access:", error);
    return false;
  }
}

async function readLocalDietDaily(uid: string): Promise<DailyLogRecord> {
  try {
    const raw = await AsyncStorage.getItem(buildDailyStorageKey(uid));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as DailyLogRecord;
    return parsed ?? {};
  } catch (error) {
    console.error("Error reading local diet daily logs:", error);
    return {};
  }
}

async function writeLocalDietDaily(
  uid: string,
  logs: DailyLogRecord,
): Promise<void> {
  try {
    await AsyncStorage.setItem(buildDailyStorageKey(uid), JSON.stringify(logs));
  } catch (error) {
    console.error("Error writing local diet daily logs:", error);
  }
}

async function readCloudDietDaily(uid: string): Promise<DailyLogRecord | null> {
  try {
    const dietRef = collection(db, USERS_COLLECTION, uid, DIET_SUBCOLLECTION);
    const snapshot = await getDocs(dietRef);
    const logs: DailyLogRecord = {};

    snapshot.docs.forEach((item) => {
      if (!item.id.startsWith(DAILY_DOC_PREFIX)) {
        return;
      }

      const dateKey = item.id.replace(DAILY_DOC_PREFIX, "");
      const data = item.data() as Partial<DietDailyLog>;

      const target = Math.max(0, Number(data.caloriesTarget ?? 0));
      logs[dateKey] = normalizeDailyLog(
        {
          ...data,
          dateKey,
          caloriesTarget: target,
          updatedAtMs: Number(data.updatedAtMs ?? Date.now()),
        },
        target,
        dateKey,
      );
    });

    return logs;
  } catch (error) {
    console.error("Error reading cloud diet daily logs:", error);
    return null;
  }
}

async function writeCloudDietDailyLog(
  uid: string,
  log: DietDailyLog,
): Promise<void> {
  try {
    const ref = doc(
      db,
      USERS_COLLECTION,
      uid,
      DIET_SUBCOLLECTION,
      `${DAILY_DOC_PREFIX}${log.dateKey}`,
    );
    await setDoc(
      ref,
      {
        ...log,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error writing cloud diet daily log:", error);
  }
}

async function loadMergedDietDaily(uid: string): Promise<DailyLogRecord> {
  const local = await readLocalDietDaily(uid);

  if (!(await canUseCloud(uid))) {
    return local;
  }

  const cloud = await readCloudDietDaily(uid);
  if (cloud === null) {
    return local;
  }

  const merged: DailyLogRecord = { ...cloud };

  for (const [dateKey, localLog] of Object.entries(local)) {
    const cloudLog = merged[dateKey];
    if (!cloudLog || localLog.updatedAtMs > cloudLog.updatedAtMs) {
      merged[dateKey] = localLog;
    }
  }

  await writeLocalDietDaily(uid, merged);

  for (const [dateKey, mergedLog] of Object.entries(merged)) {
    const cloudLog = cloud[dateKey];
    if (!cloudLog || mergedLog.updatedAtMs > cloudLog.updatedAtMs) {
      await writeCloudDietDailyLog(uid, mergedLog);
    }
  }

  return merged;
}

function computeStreak(logs: DailyLogRecord): DietStreakSummary {
  const successfulDates = Object.values(logs)
    .filter((log) => log.goalMet)
    .map((log) => log.dateKey)
    .sort();

  if (successfulDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      completedDays: 0,
    };
  }

  let best = 1;
  let running = 1;

  for (let i = 1; i < successfulDates.length; i++) {
    const prev = successfulDates[i - 1];
    const current = successfulDates[i];

    if (current === addDays(prev, 1)) {
      running += 1;
    } else {
      running = 1;
    }

    if (running > best) {
      best = running;
    }
  }

  const today = toDateKey(new Date());
  let currentStreak = 0;
  let cursor = today;
  const successSet = new Set(successfulDates);

  while (successSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    currentStreak,
    bestStreak: best,
    completedDays: successfulDates.length,
  };
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

export async function loadTodayDietTracking(
  uid: string,
  caloriesTarget: number,
): Promise<{ today: DietDailyLog; streak: DietStreakSummary }> {
  const logs = await loadMergedDietDaily(uid);
  const todayKey = getTodayDateKey();

  const today = logs[todayKey]
    ? normalizeDailyLog(logs[todayKey], caloriesTarget, todayKey)
    : normalizeDailyLog({}, caloriesTarget, todayKey);

  if (
    !logs[todayKey] ||
    logs[todayKey].caloriesTarget !== today.caloriesTarget
  ) {
    logs[todayKey] = today;
    await writeLocalDietDaily(uid, logs);
    if (await canUseCloud(uid)) {
      await writeCloudDietDailyLog(uid, today);
    }
  }

  return {
    today,
    streak: computeStreak(logs),
  };
}

export async function saveTodayDietTracking(
  uid: string,
  input: {
    caloriesConsumed: number;
    mealsCount: number;
    proteinConsumed?: number;
    carbsConsumed?: number;
    fatsConsumed?: number;
  },
  caloriesTarget: number,
): Promise<{ today: DietDailyLog; streak: DietStreakSummary }> {
  const logs = await loadMergedDietDaily(uid);
  const todayKey = getTodayDateKey();

  const today = normalizeDailyLog(
    {
      ...logs[todayKey],
      dateKey: todayKey,
      caloriesConsumed: input.caloriesConsumed,
      mealsCount: input.mealsCount,
      proteinConsumed:
        input.proteinConsumed ?? logs[todayKey]?.proteinConsumed ?? 0,
      carbsConsumed: input.carbsConsumed ?? logs[todayKey]?.carbsConsumed ?? 0,
      fatsConsumed: input.fatsConsumed ?? logs[todayKey]?.fatsConsumed ?? 0,
      updatedAtMs: Date.now(),
    },
    caloriesTarget,
    todayKey,
  );

  logs[todayKey] = today;
  await writeLocalDietDaily(uid, logs);

  if (await canUseCloud(uid)) {
    await writeCloudDietDailyLog(uid, today);
  }

  return {
    today,
    streak: computeStreak(logs),
  };
}

export async function addTodayDietMealEntry(
  uid: string,
  input: {
    calories: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  },
  caloriesTarget: number,
): Promise<{ today: DietDailyLog; streak: DietStreakSummary }> {
  const logs = await loadMergedDietDaily(uid);
  const todayKey = getTodayDateKey();
  const existing = normalizeDailyLog(
    logs[todayKey] ?? {},
    caloriesTarget,
    todayKey,
  );

  const today = normalizeDailyLog(
    {
      ...existing,
      dateKey: todayKey,
      caloriesConsumed: existing.caloriesConsumed + Math.max(0, input.calories),
      mealsCount: existing.mealsCount + 1,
      proteinConsumed:
        existing.proteinConsumed + Math.max(0, input.protein ?? 0),
      carbsConsumed: existing.carbsConsumed + Math.max(0, input.carbs ?? 0),
      fatsConsumed: existing.fatsConsumed + Math.max(0, input.fats ?? 0),
      updatedAtMs: Date.now(),
    },
    caloriesTarget,
    todayKey,
  );

  logs[todayKey] = today;
  await writeLocalDietDaily(uid, logs);

  if (await canUseCloud(uid)) {
    await writeCloudDietDailyLog(uid, today);
  }

  return {
    today,
    streak: computeStreak(logs),
  };
}

export async function loadRecentDietHistory(
  uid: string,
  caloriesTarget: number,
  days = 7,
): Promise<DietDailyHistoryItem[]> {
  const logs = await loadMergedDietDaily(uid);
  const totalDays = Math.max(1, Math.round(days));
  const todayKey = getTodayDateKey();
  const history: DietDailyHistoryItem[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const dateKey = addDays(todayKey, -i);
    const base = logs[dateKey]
      ? normalizeDailyLog(logs[dateKey], caloriesTarget, dateKey)
      : normalizeDailyLog({}, caloriesTarget, dateKey);

    history.push({
      dateKey,
      caloriesConsumed: base.caloriesConsumed,
      caloriesTarget: base.caloriesTarget,
      mealsCount: base.mealsCount,
      goalMet: base.goalMet,
      isToday: dateKey === todayKey,
    });
  }

  return history;
}
