const STORAGE_KEY = 'athletelog_mini_state_v1';

function pad(number) {
  return String(number).padStart(2, '0');
}

function todayKey(date) {
  const value = date || new Date();
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
}

function emptyState() {
  return {
    version: 1,
    goals: {
      protein: 160,
      calories: 2400,
      water: 2500
    },
    days: {}
  };
}

function normalizeState(raw) {
  const fallback = emptyState();
  if (!raw || typeof raw !== 'object') return fallback;

  return {
    version: 1,
    goals: {
      protein: Number(raw.goals && raw.goals.protein) || fallback.goals.protein,
      calories: Number(raw.goals && raw.goals.calories) || fallback.goals.calories,
      water: Number(raw.goals && raw.goals.water) || fallback.goals.water
    },
    days: raw.days && typeof raw.days === 'object' ? raw.days : {}
  };
}

function loadState() {
  try {
    return normalizeState(wx.getStorageSync(STORAGE_KEY));
  } catch (error) {
    return emptyState();
  }
}

function saveState(state) {
  const normalized = normalizeState(state);
  wx.setStorageSync(STORAGE_KEY, normalized);
  return normalized;
}

function getDay(state, key) {
  const dayKey = key || todayKey();
  if (!state.days[dayKey]) {
    state.days[dayKey] = {
      foods: [],
      waterMl: 0,
      workouts: [],
      period: false,
      rpe: 0
    };
  }

  const day = state.days[dayKey];
  if (!Array.isArray(day.foods)) day.foods = [];
  if (!Array.isArray(day.workouts)) day.workouts = [];
  if (typeof day.waterMl !== 'number') day.waterMl = 0;
  if (typeof day.period !== 'boolean') day.period = false;
  if (typeof day.rpe !== 'number') day.rpe = 0;
  return day;
}

function totalsForDay(day) {
  return (day.foods || []).reduce(function (totals, food) {
    totals.protein += Number(food.protein) || 0;
    totals.fat += Number(food.fat) || 0;
    totals.carbs += Number(food.carbs) || 0;
    totals.calories += Number(food.calories) || 0;
    return totals;
  }, { protein: 0, fat: 0, carbs: 0, calories: 0 });
}

function hasActivity(day) {
  if (!day) return false;
  return (day.foods && day.foods.length > 0) ||
    (day.workouts && day.workouts.length > 0) ||
    Number(day.waterMl) > 0;
}

function calculateStreak(state) {
  let streak = 0;
  const cursor = new Date();
  for (let offset = 0; offset < 366; offset += 1) {
    const key = todayKey(cursor);
    if (!hasActivity(state.days[key])) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function lastDays(state, count) {
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = todayKey(date);
    const day = state.days[key] || { foods: [], waterMl: 0, workouts: [], period: false };
    result.push({ key: key, date: date, day: day, totals: totalsForDay(day) });
  }
  return result;
}

function clearState() {
  wx.removeStorageSync(STORAGE_KEY);
  return emptyState();
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  todayKey: todayKey,
  emptyState: emptyState,
  normalizeState: normalizeState,
  loadState: loadState,
  saveState: saveState,
  getDay: getDay,
  totalsForDay: totalsForDay,
  calculateStreak: calculateStreak,
  lastDays: lastDays,
  clearState: clearState
};
