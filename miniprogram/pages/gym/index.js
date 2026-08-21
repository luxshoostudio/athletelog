const store = require('../../utils/store');

const TEMPLATES = {
  Push: ['Bench press', 'Shoulder press', 'Triceps pushdown'],
  Pull: ['Lat pulldown', 'Seated row', 'Biceps curl'],
  Legs: ['Squat', 'Romanian deadlift', 'Leg press'],
  'Full body': ['Squat', 'Bench press', 'Lat pulldown']
};

function newExercise(name) {
  return {
    id: String(Date.now()) + String(Math.floor(Math.random() * 10000)),
    name: name,
    sets: '3',
    reps: '8',
    weight: '',
    completed: false
  };
}

function shortDate(key) {
  const parts = key.split('-');
  return parts[1] + '/' + parts[2];
}

Page({
  data: {
    templates: Object.keys(TEMPLATES),
    sessionName: '',
    exercises: [],
    completedCount: 0,
    customName: '',
    history: []
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    const state = store.loadState();
    const day = store.getDay(state);
    const exercises = day.workouts || [];
    this.state = state;
    this.setData({
      sessionName: day.sessionName || '',
      exercises: exercises,
      completedCount: exercises.filter(function (item) { return item.completed; }).length,
      history: this.buildHistory(state)
    });
  },

  buildHistory: function (state) {
    return Object.keys(state.days)
      .sort()
      .reverse()
      .filter(function (key) {
        return key !== store.todayKey() && state.days[key].workouts && state.days[key].workouts.length;
      })
      .slice(0, 6)
      .map(function (key) {
        const workouts = state.days[key].workouts;
        return {
          key: key,
          label: shortDate(key),
          name: state.days[key].sessionName || 'Workout',
          completed: workouts.filter(function (item) { return item.completed; }).length,
          total: workouts.length
        };
      });
  },

  chooseTemplate: function (event) {
    const name = event.currentTarget.dataset.name;
    if (!TEMPLATES[name]) return;
    const that = this;
    const start = function () { that.applyTemplate(name); };
    if (this.data.exercises.length) {
      wx.showModal({
        title: 'Replace today’s plan?',
        content: 'This will replace the exercises currently listed for today.',
        confirmColor: '#bd5b25',
        success: function (result) {
          if (result.confirm) start();
        }
      });
    } else {
      start();
    }
  },

  applyTemplate: function (name) {
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.sessionName = name;
    day.workouts = TEMPLATES[name].map(newExercise);
    store.saveState(state);
    this.refresh();
  },

  onCustomName: function (event) {
    this.setData({ customName: event.detail.value });
  },

  addCustomExercise: function () {
    const name = this.data.customName.trim();
    if (!name) {
      wx.showToast({ title: 'Enter an exercise', icon: 'none' });
      return;
    }
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    if (!day.sessionName) day.sessionName = 'Custom';
    day.workouts.push(newExercise(name));
    store.saveState(state);
    this.setData({ customName: '' });
    this.refresh();
  },

  updateExercise: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    if (!['sets', 'reps', 'weight'].includes(field) || !this.data.exercises[index]) return;
    const path = 'exercises[' + index + '].' + field;
    this.setData({ [path]: event.detail.value });
  },

  saveExercises: function () {
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.workouts = this.data.exercises;
    store.saveState(state);
    this.state = state;
  },

  toggleComplete: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!this.data.exercises[index]) return;
    const exercises = this.data.exercises.slice();
    exercises[index] = Object.assign({}, exercises[index], { completed: !exercises[index].completed });
    const nextCount = exercises.filter(function (item) { return item.completed; }).length;
    const that = this;
    this.setData({ exercises: exercises, completedCount: nextCount }, function () { that.saveExercises(); });
  },

  deleteExercise: function (event) {
    const index = Number(event.currentTarget.dataset.index);
    const exercises = this.data.exercises.slice();
    exercises.splice(index, 1);
    const nextCount = exercises.filter(function (item) { return item.completed; }).length;
    const that = this;
    this.setData({ exercises: exercises, completedCount: nextCount }, function () { that.saveExercises(); });
  }
});
