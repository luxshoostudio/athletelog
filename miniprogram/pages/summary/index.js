const store = require('../../utils/store');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

Page({
  data: {
    averageProtein: 0,
    averageCalories: 0,
    workoutCount: 0,
    activeDays: 0,
    week: [],
    proteinGoal: '160',
    calorieGoal: '2400',
    waterGoal: '2500'
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    const state = store.loadState();
    const days = store.lastDays(state, 7);
    const proteinTotal = days.reduce(function (sum, item) { return sum + item.totals.protein; }, 0);
    const calorieTotal = days.reduce(function (sum, item) { return sum + item.totals.calories; }, 0);
    const workoutCount = days.reduce(function (sum, item) {
      return sum + (item.day.workouts || []).filter(function (exercise) { return exercise.completed; }).length;
    }, 0);
    const activeDays = days.filter(function (item) {
      return item.day.foods.length || item.day.waterMl || item.day.workouts.length;
    }).length;

    this.state = state;
    this.setData({
      averageProtein: Math.round(proteinTotal / 7),
      averageCalories: Math.round(calorieTotal / 7),
      workoutCount: workoutCount,
      activeDays: activeDays,
      proteinGoal: String(state.goals.protein),
      calorieGoal: String(state.goals.calories),
      waterGoal: String(state.goals.water),
      week: days.map(function (item) {
        return {
          key: item.key,
          label: DAY_NAMES[item.date.getDay()],
          protein: Math.round(item.totals.protein),
          calories: Math.round(item.totals.calories),
          proteinWidth: Math.min(100, Math.round((item.totals.protein / state.goals.protein) * 100)),
          trained: (item.day.workouts || []).some(function (exercise) { return exercise.completed; })
        };
      })
    });
  },

  onProteinGoal: function (event) {
    this.setData({ proteinGoal: event.detail.value });
  },

  onCalorieGoal: function (event) {
    this.setData({ calorieGoal: event.detail.value });
  },

  onWaterGoal: function (event) {
    this.setData({ waterGoal: event.detail.value });
  },

  saveGoals: function () {
    const protein = Number(this.data.proteinGoal);
    const calories = Number(this.data.calorieGoal);
    const water = Number(this.data.waterGoal);
    if (protein <= 0 || calories <= 0 || water <= 0) {
      wx.showToast({ title: 'Goals must be above zero', icon: 'none' });
      return;
    }
    const state = this.state || store.loadState();
    state.goals = { protein: protein, calories: calories, water: water };
    store.saveState(state);
    wx.showToast({ title: 'Goals saved', icon: 'success' });
    this.refresh();
  },

  exportBackup: function () {
    const state = store.loadState();
    const fileName = 'athletelog-backup-' + store.todayKey() + '.json';
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName;
    const fileSystem = wx.getFileSystemManager();
    fileSystem.writeFile({
      filePath: filePath,
      data: JSON.stringify({
        app: 'AthleteLog',
        exportedAt: new Date().toISOString(),
        data: state
      }, null, 2),
      encoding: 'utf8',
      success: function () {
        if (typeof wx.shareFileMessage === 'function') {
          wx.shareFileMessage({
            filePath: filePath,
            fileName: fileName,
            fail: function () {
              wx.showModal({ title: 'Backup ready', content: 'The JSON backup was created, but sharing was cancelled.', showCancel: false });
            }
          });
        } else {
          wx.showModal({ title: 'Backup ready', content: 'The JSON backup is stored in this mini program’s local files.', showCancel: false });
        }
      },
      fail: function () {
        wx.showToast({ title: 'Could not create backup', icon: 'none' });
      }
    });
  },

  importBackup: function () {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: function (result) {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: function (readResult) {
            try {
              const parsed = JSON.parse(readResult.data);
              const candidate = parsed.data || parsed;
              if (!candidate || typeof candidate !== 'object' || !candidate.days) throw new Error('Invalid backup');
              store.saveState(store.normalizeState(candidate));
              wx.showToast({ title: 'Backup restored', icon: 'success' });
              that.refresh();
            } catch (error) {
              wx.showToast({ title: 'Not an AthleteLog backup', icon: 'none' });
            }
          },
          fail: function () {
            wx.showToast({ title: 'Could not read the file', icon: 'none' });
          }
        });
      }
    });
  },

  clearEverything: function () {
    const that = this;
    wx.showModal({
      title: 'Start fresh?',
      content: 'This permanently removes all AthleteLog data stored in this mini program.',
      confirmText: 'Clear data',
      confirmColor: '#a34e35',
      success: function (result) {
        if (!result.confirm) return;
        store.clearState();
        wx.showToast({ title: 'Data cleared', icon: 'success' });
        that.refresh();
      }
    });
  }
});
