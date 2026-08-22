const store = require('../../utils/store');
const fooddb = require('../../utils/fooddb');

function dateLabel(date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + weekdays[date.getDay()];
}

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function buildFavorites(state) {
  const map = {};
  Object.keys(state.days || {}).sort().forEach(function (key) {
    const foods = (state.days[key] && state.days[key].foods) || [];
    foods.forEach(function (food) {
      const name = (food.name || '').trim();
      if (!name) return;
      if (!map[name]) {
        map[name] = { name: name, count: 0, protein: 0, fat: 0, carbs: 0, calories: 0 };
      }
      map[name].count += 1;
      map[name].protein = Number(food.protein) || map[name].protein;
      map[name].fat = Number(food.fat) || map[name].fat;
      map[name].carbs = Number(food.carbs) || map[name].carbs;
      map[name].calories = Number(food.calories) || map[name].calories;
    });
  });
  return Object.keys(map)
    .map(function (name) { return map[name]; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 6);
}

function computeGrams(food, amount, unit) {
  if (unit === '克' || unit === '毫升') return amount;
  return amount * (food.unitGrams || 0);
}

Page({
  data: {
    dateLabel: '',
    streak: 0,
    period: false,
    favorites: [],
    foods: [],
    waterMl: 0,
    waterGoal: 2500,
    totals: { protein: 0, calories: 0 },
    goals: { protein: 160, calories: 2400, water: 2500 },
    proteinPct: 0,
    caloriePct: 0,
    showFoodSheet: false,
    foodSearch: '',
    foodResults: [],
    selectedFood: null,
    foodAmount: '',
    foodUnit: '克',
    foodTime: '',
    foodMacros: { protein: 0, fat: 0, carbs: 0, calories: 0, fiber: 0, vitaminC: 0 }
  },

  onLoad: function () {
    this.setData({ dateLabel: dateLabel(new Date()) });
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

    const foods = day.foods.slice().reverse().map(function (f) {
      return {
        id: f.id,
        name: f.name,
        protein: Number(f.protein) || 0,
        fat: Number(f.fat) || 0,
        calories: Number(f.calories) || 0,
        fiber: Number(f.fiber) || 0,
        vitaminC: Number(f.vitaminC) || 0,
        time: f.time || ''
      };
    });

    this.state = state;
    const that = this;
    this.setData({
      streak: store.calculateStreak(state),
      period: day.period,
      favorites: buildFavorites(state),
      foods: foods,
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
    const favorite = this.data.favorites[index];
    if (!favorite) return;
    this.addFood({
      name: favorite.name,
      protein: favorite.protein,
      fat: favorite.fat,
      carbs: favorite.carbs,
      calories: favorite.calories
    });
  },

  goToCoach: function () {
    wx.navigateTo({ url: '/pages/coach/index' });
  },

  recognizeFood: function () {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: function (res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        wx.compressImage({
          src: file.tempFilePath,
          quality: 60,
          success: function (compRes) {
            that.readImageAndRecognize(compRes.tempFilePath);
          },
          fail: function () {
            that.readImageAndRecognize(file.tempFilePath);
          }
        });
      }
    });
  },

  readImageAndRecognize: function (filePath) {
    const that = this;
    wx.showLoading({ title: '识别中…', mask: true });
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (readRes) {
        wx.cloud.callFunction({
          name: 'foodRecognition',
          data: { imageBase64: readRes.data },
          success: function (callRes) {
            wx.hideLoading();
            const r = callRes.result || {};
            if (r.ok && r.name && r.name !== '无法识别') {
              that.setData({
                showFoodSheet: true,
                foodSearch: r.name,
                foodResults: fooddb.searchFood(r.name),
                selectedFood: null,
                foodAmount: '',
                foodTime: nowTime()
              });
            } else {
              wx.showToast({ title: r.error || '没识别出来，换个角度再试', icon: 'none' });
            }
          },
          fail: function () {
            wx.hideLoading();
            wx.showToast({ title: '识别失败，请确认已部署云函数', icon: 'none' });
          }
        });
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '读取图片失败', icon: 'none' });
      }
    });
  },

  openFoodSheet: function () {
    this.setData({
      showFoodSheet: true,
      foodSearch: '',
      foodResults: fooddb.searchFood(''),
      selectedFood: null,
      foodAmount: '',
      foodUnit: '克',
      foodTime: nowTime(),
      foodMacros: { protein: 0, fat: 0, carbs: 0, calories: 0, fiber: 0, vitaminC: 0 }
    });
  },

  closeFoodSheet: function () {
    this.setData({ showFoodSheet: false });
  },

  stopPropagation: function () {},

  onFoodSearch: function (event) {
    const q = event.detail.value;
    this.setData({ foodSearch: q, foodResults: fooddb.searchFood(q), selectedFood: null });
  },

  selectFood: function (event) {
    const name = event.currentTarget.dataset.name;
    const food = fooddb.getFood(name);
    if (!food) return;
    this.setData({
      selectedFood: food,
      foodSearch: food.name,
      foodUnit: food.unit,
      foodAmount: '',
      foodMacros: { protein: 0, fat: 0, carbs: 0, calories: 0, fiber: 0, vitaminC: 0 }
    });
  },

  reselectFood: function () {
    this.setData({ selectedFood: null, foodSearch: '', foodResults: fooddb.searchFood(''), foodAmount: '' });
  },

  onFoodAmount: function (event) {
    this.setData({ foodAmount: event.detail.value });
    this.recomputeMacros();
  },

  changeUnit: function () {
    const food = this.data.selectedFood;
    if (!food) return;
    const natural = food.unit;
    if (natural === '克' || natural === '毫升') return;
    const current = this.data.foodUnit;
    this.setData({ foodUnit: current === natural ? '克' : natural });
    this.recomputeMacros();
  },

  onFoodTime: function (event) {
    this.setData({ foodTime: event.detail.value });
  },

  recomputeMacros: function () {
    const food = this.data.selectedFood;
    if (!food) return;
    const amount = Number(this.data.foodAmount) || 0;
    const grams = computeGrams(food, amount, this.data.foodUnit);
    const ratio = grams / 100;
    this.setData({
      foodMacros: {
        protein: Math.round(food.protein * ratio),
        fat: Math.round(food.fat * ratio),
        carbs: Math.round(food.carbs * ratio),
        calories: Math.round(food.calories * ratio),
        fiber: Math.round((food.fiber || 0) * ratio),
        vitaminC: Math.round((food.vitaminC || 0) * ratio)
      }
    });
  },

  saveFood: function () {
    const food = this.data.selectedFood;
    if (!food) {
      wx.showToast({ title: '请先选择食物', icon: 'none' });
      return;
    }
    const amount = Number(this.data.foodAmount) || 0;
    if (amount <= 0) {
      wx.showToast({ title: '请填写数量', icon: 'none' });
      return;
    }
    const grams = computeGrams(food, amount, this.data.foodUnit);
    const ratio = grams / 100;
    this.addFood({
      name: food.name,
      amount: amount,
      unit: this.data.foodUnit,
      protein: Math.round(food.protein * ratio),
      fat: Math.round(food.fat * ratio),
      carbs: Math.round(food.carbs * ratio),
      calories: Math.round(food.calories * ratio),
      fiber: Math.round((food.fiber || 0) * ratio),
      vitaminC: Math.round((food.vitaminC || 0) * ratio),
      time: this.data.foodTime
    });
    this.closeFoodSheet();
  },

  addFood: function (food) {
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.foods.push({
      id: String(Date.now()) + String(Math.floor(Math.random() * 1000)),
      name: food.name,
      amount: food.amount || '',
      unit: food.unit || '',
      protein: Number(food.protein) || 0,
      fat: Number(food.fat) || 0,
      carbs: Number(food.carbs) || 0,
      calories: Number(food.calories) || 0,
      fiber: Number(food.fiber) || 0,
      vitaminC: Number(food.vitaminC) || 0,
      time: food.time || nowTime(),
      createdAt: new Date().toISOString()
    });
    store.saveState(state);
    wx.showToast({ title: '已添加', icon: 'success', duration: 700 });
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
      title: '重置饮水？',
      content: '今日饮水将归零。',
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
