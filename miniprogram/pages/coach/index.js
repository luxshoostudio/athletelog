const store = require('../../utils/store');

let seq = 0;
function withId(role, content) {
  seq += 1;
  return { id: 'm' + Date.now() + '_' + seq, role: role, content: content };
}

Page({
  data: {
    messages: [],
    inputValue: '',
    loading: false,
    scrollIntoView: ''
  },

  onLoad: function () {
    this.setData({
      messages: [withId('assistant', '嗨，我是你的私教助手。今天蛋白够没够、这个动作练哪里、怎么安排训练，都可以问我。')]
    });
  },

  buildContext: function () {
    const state = store.loadState();
    const day = store.getDay(state);
    const totals = store.totalsForDay(day);
    const workouts = day.workouts || [];
    const done = workouts.filter(function (w) { return w.completed; }).length;
    return [
      '目标：蛋白质 ' + state.goals.protein + 'g，卡路里 ' + state.goals.calories + '，饮水 ' + state.goals.water + 'ml',
      '今天已记录：蛋白质 ' + totals.protein + 'g，卡路里 ' + totals.calories + '，饮水 ' + day.waterMl + 'ml',
      '今天训练动作 ' + workouts.length + ' 个，完成 ' + done + ' 个',
      '连续记录 ' + store.calculateStreak(state) + ' 天'
    ].join('；');
  },

  onInput: function (event) {
    this.setData({ inputValue: event.detail.value });
  },

  send: function () {
    const text = this.data.inputValue.trim();
    if (!text || this.data.loading) return;

    const that = this;
    const messages = this.data.messages.concat([withId('user', text)]);
    this.setData({ messages: messages, inputValue: '', loading: true, scrollIntoView: 'bottom' });

    const apiMessages = messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    wx.cloud.callFunction({
      name: 'aiChat',
      data: { messages: apiMessages, context: this.buildContext() },
      success: function (res) {
        const r = res.result || {};
        if (r.ok) {
          that.setData({
            messages: that.data.messages.concat([withId('assistant', r.reply)]),
            loading: false,
            scrollIntoView: 'bottom'
          });
        } else {
          that.setData({
            messages: that.data.messages.concat([withId('assistant', '出错了：' + (r.error || '未知错误'))]),
            loading: false,
            scrollIntoView: 'bottom'
          });
        }
      },
      fail: function () {
        that.setData({
          messages: that.data.messages.concat([withId('assistant', '调用失败，请确认已开通云开发并部署了 aiChat 云函数。')]),
          loading: false,
          scrollIntoView: 'bottom'
        });
      }
    });
  }
});
