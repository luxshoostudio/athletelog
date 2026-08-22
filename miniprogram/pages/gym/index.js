const store = require('../../utils/store');

const TEMPLATES = {
  '力量': ['深蹲', '卧推', '硬拉', '肩推'],
  '有氧': ['跑步', '跳绳', '骑行'],
  '上身': ['卧推', '划船', '肩推', '弯举'],
  '下身': ['深蹲', '硬拉', '腿举', '弓步']
};

const EXERCISE_LIBRARY = [
  { group: '胸', items: ['卧推', '上斜卧推', '俯卧撑', '哑铃飞鸟', '双杠臂屈伸', '夹胸'] },
  { group: '背', items: ['引体向上', '高位下拉', '坐姿划船', '硬拉', '单臂划船', '山羊挺身'] },
  { group: '肩', items: ['肩推', '侧平举', '前平举', '反向飞鸟', '直立划船'] },
  { group: '手臂', items: ['二头弯举', '三头下压', '锤式弯举', '窄距卧推'] },
  { group: '核心', items: ['卷腹', '平板支撑', '俄罗斯转体', '仰卧举腿', '侧平板'] },
  { group: '腿', items: ['深蹲', '弓步', '腿举', '腿屈伸', '提踵', '保加利亚分腿蹲'] },
  { group: '臀', items: ['臀桥', '髋外展', '后踢腿', '臀推'] },
  { group: '有氧', items: ['跑步', '跳绳', '骑行', '划船机', '登山机', '椭圆机'] }
];

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
    history: [],
    rpe: 0,
    rpeOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    showLibrary: false,
    groups: EXERCISE_LIBRARY.map(function (item) { return item.group; }),
    activeGroup: EXERCISE_LIBRARY[0].group,
    libraryItems: EXERCISE_LIBRARY[0].items
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
      rpe: day.rpe || 0,
      history: this.buildHistory(state)
    });
  },

  setRpe: function (event) {
    const value = Number(event.currentTarget.dataset.value);
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    day.rpe = value;
    store.saveState(state);
    this.setData({ rpe: value });
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
          name: state.days[key].sessionName || '训练',
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
        title: '替换今日计划？',
        content: '这会替换掉今天已经列出的动作。',
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

  openLibrary: function () {
    this.setData({ showLibrary: true, customName: '' });
  },

  closeLibrary: function () {
    this.setData({ showLibrary: false });
  },

  stopPropagation: function () {},

  selectGroup: function (event) {
    const group = event.currentTarget.dataset.group;
    const found = EXERCISE_LIBRARY.filter(function (item) { return item.group === group; })[0];
    if (!found) return;
    this.setData({ activeGroup: group, libraryItems: found.items });
  },

  addFromLibrary: function (event) {
    const name = event.currentTarget.dataset.name;
    if (!name) return;
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    if (!day.sessionName) day.sessionName = '自定义';
    day.workouts.push(newExercise(name));
    store.saveState(state);
    this.setData({ showLibrary: false });
    this.refresh();
  },

  onCustomName: function (event) {
    this.setData({ customName: event.detail.value });
  },

  addCustomExercise: function () {
    const name = this.data.customName.trim();
    if (!name) {
      wx.showToast({ title: '请输入动作名称', icon: 'none' });
      return;
    }
    const state = this.state || store.loadState();
    const day = store.getDay(state);
    if (!day.sessionName) day.sessionName = '自定义';
    day.workouts.push(newExercise(name));
    store.saveState(state);
    this.setData({ customName: '', showLibrary: false });
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
