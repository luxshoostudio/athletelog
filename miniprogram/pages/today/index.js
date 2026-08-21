const store = require('../../utils/store');

const FAVORITES = [
  { name: 'Eggs × 2', protein: 13, calories: 156 },
  { name: 'Protein shake', protein: 25, calories: 120 },
  { name: 'Greek yogurt', protein: 17, calories: 130 },
  { name: 'Chicken breast', protein: 31, calories: 165 }
];

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function dateLabel(date) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return weekdays[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate();
}

Page({
  data: {
    greeting: '',
    dateLabel: '',
    streak: 0,
    period: false,
    favorites: FAVORITES,
    foods: [],
    waterMl: 0,
    waterGoal: 2500,
    totals: { protein: 0, calories: 0 },
    goals: { protein: 160, calories: 2400, water: 2500 },
    proteinPct: 0,
    caloriePct: 0,
    showFoodSheet: false,
    foodName: '',
    foodProtein: '',
    foodCalories: ''
  },

  onLoad: function () {
    const now = new Date();
    this.setData({
      greeting: greetingForHour(now.getHours()),
      dateLabel: dateLabel(now)
    });
  },

  onReady: function () {
    this.refresh();
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    const state = store.loadState();
    const day = store.getDay(state);
    const totals = store.totalsForDay(day);
    const proteinPct = Math.min(100, Math.round((totals.protein / state.goals.protein) * 100));
    const caloriePct = Math.min(100, Math.round((totals.calories / state.goals.calories) * 100));

    this.state = state;
    const that = this;
    this.setData({
      streak: store.calculateStreak(state),
      period: day.period,
      foods: day.foods.slice().reverse(),
      waterMl: day.waterMl,
      waterGoal: state.goals.water,
      totals: totals,
      goals: state.goals,
      proteinPct: proteinPct,
      caloriePct: caloriePct
    }, function () { that.drawProteinRing(); });
  },

  drawProteinRing: function () {
    if (!this.data || typeof wx.createCanvasContext !== 'function') return;
    const context = wx.createCanvasContext('proteinRing', this);
    const center = 62;
    const radius = 50;
    const start = -Math.PI / 2;
    const progress = Math.min(1, this.data.proteinPct / 100);

    context.setLineWidth(10);
    context.setLineCap('round');
    context.setStrokeStyle('#ded6c7');
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();

    if (progress > 0) {
      context.setStrokeStyle('#bf5c27');
      context.beginPath();
      context.arc(center, center, radius, start, start + Math.PI * 2 * progress);
      context.stroke();
    }
    context.draw();
  },

  togglePeriod: function (event) {
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.period = Boolean(event.detail.value);
    store.saveState(state);
    this.setData({ period: day.period });
  },

  addFavorite: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const favorite = FAVORITES[index];
    if (!favorite) return;
    this.addFood(favorite);
  },

  openFoodSheet: function () {
    this.setData({
      showFoodSheet: true,
      foodName: '',
      foodProtein: '',
      foodCalories: ''
    });
  },

  closeFoodSheet: function () {
    this.setData({ showFoodSheet: false });
  },

  stopPropagation: function () {},

  onFoodName: function (event) {
    this.setData({ foodName: event.detail.value });
  },

  onFoodProtein: function (event) {
    this.setData({ foodProtein: event.detail.value });
  },

  onFoodCalories: function (event) {
    this.setData({ foodCalories: event.detail.value });
  },

  saveCustomFood: function () {
    const name = this.data.foodName.trim();
    const protein = Number(this.data.foodProtein);
    const calories = Number(this.data.foodCalories);
    if (!name) {
      wx.showToast({ title: 'Add a food name', icon: 'none' });
      return;
    }
    if (protein < 0 || calories < 0 || Number.isNaN(protein) || Number.isNaN(calories)) {
      wx.showToast({ title: 'Check protein and calories', icon: 'none' });
      return;
    }
    this.addFood({ name: name, protein: protein, calories: calories });
    this.closeFoodSheet();
  },

  addFood: function (food) {
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.foods.push({
      id: String(Date.now()) + String(Math.floor(Math.random() * 1000)),
      name: food.name,
      protein: Number(food.protein) || 0,
      calories: Number(food.calories) || 0,
      createdAt: new Date().toISOString()
    });
    store.saveState(state);
    wx.showToast({ title: 'Added', icon: 'success', duration: 700 });
    this.refresh();
  },

  deleteFood: function (event) {
    const id = String(event.currentTarget.dataset.id);
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.foods = day.foods.filter(function (food) {
      return String(food.id) !== id;
    });
    store.saveState(state);
    this.refresh();
  },

  addWater: function (event) {
    const amount = Number(event.currentTarget.dataset.amount) || 0;
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.waterMl += amount;
    store.saveState(state);
    this.refresh();
  },

  resetWater: function () {
    const that = this;
    wx.showModal({
      title: 'Reset water?',
      content: 'Today’s water will return to zero.',
      confirmColor: '#bd5b25',
      success: function (result) {
        if (!result.confirm) return;
        const state = that.state || store.loadState();
        store.getDay(state).waterMl = 0;
        store.saveState(state);
        that.refresh();
      }
    });
  }
});
