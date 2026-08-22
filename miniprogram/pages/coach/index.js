const store = require('../../utils/store');

let seq = 0;
function withId(role, content) {
  seq += 1;
  return { id: 'm' + Date.now() + '_' + seq, role: role, content: content };
}

// 本地兜底：未配置云函数 / 云函数失败时，先用本地规则回答常见问题
function localReply(text, context) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;

  if (text === '__fallback__') {
    return '云端教练暂时联系不上，我先按本地规则帮你看。把今天吃了啥、练了啥贴给我，我直接给反馈。';
  }
  if (/你叫什么|你是谁|叫什么名字|你叫啥|你是啥/.test(raw)) {
    return '我是 Lux私教笔记 的本地教练小助手。能看你今天的蛋白/卡路里/训练，也能聊动作怎么发力、训练怎么排。复杂问题我会请云端教练（DeepSeek）来答。';
  }
  if (/^(你好|hi|hello|嗨|嘿|哈喽|在吗|在么)[?!。. ~]*$/.test(lower)) {
    return '嗨，在的。今天练什么、吃了什么、想聊啥？';
  }
  if (/谢谢|感谢|^thx|^thanks/i.test(raw)) {
    return '不客气，随时叫我。';
  }
  if (/你能做什么|你会什么|你能干啥|有什么功能|怎么用|你会啥/.test(raw)) {
    return '我能：① 看今天的蛋白/卡路里/饮水/训练；② 聊动作怎么做、练哪块；③ 帮你排训练。复杂的我请云端教练上。';
  }
  if (context && /今天|帮我看|看看|多少|够吗|差|怎么/.test(raw)) {
    const todayLine = context.split('；').find(function (s) { return s.indexOf('今天已记录') >= 0; }) || '';
    const goalLine = context.split('；')[0] || '';
    const workoutLine = context.split('；').find(function (s) { return s.indexOf('训练动作') >= 0; }) || '';
    const streakLine = context.split('；').find(function (s) { return s.indexOf('连续记录') >= 0; }) || '';
    if (/蛋白/.test(raw)) {
      return [todayLine, goalLine, streakLine].filter(Boolean).join('；') + '。想凑蛋白的话，鸡蛋/鸡胸/无糖酸奶是性价比最高的。';
    }
    if (/卡路里|热量/.test(raw)) {
      return [todayLine, goalLine].filter(Boolean).join('；') + '。';
    }
    if (/饮水|喝水/.test(raw)) {
      return todayLine + '。';
    }
    if (/训练|练/.test(raw)) {
      return workoutLine + '。' + streakLine + '。';
    }
  }
  return null;
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
    const text = (this.data.inputValue || '').trim();
    if (!text || this.data.loading) return;

    const that = this;
    const messages = this.data.messages.concat([withId('user', text)]);
    this.setData({ messages: messages, inputValue: '', loading: true, scrollIntoView: 'bottom' });

    const context = this.buildContext();

    // 1) 本地规则优先（即使没配云函数也能回答简单问题）
    const local = localReply(text, context);
    if (local) {
      this.setData({
        messages: this.data.messages.concat([withId('assistant', local)]),
        loading: false,
        scrollIntoView: 'bottom'
      });
      return;
    }

    // 2) 云函数
    const apiMessages = messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    wx.cloud.callFunction({
      name: 'aiChat',
      data: { messages: apiMessages, context: context },
      success: function (res) {
        const r = res.result || {};
        if (r.ok) {
          that.setData({
            messages: that.data.messages.concat([withId('assistant', r.reply)]),
            loading: false,
            scrollIntoView: 'bottom'
          });
        } else {
          const fallback = localReply('__fallback__', context) || '云端教练暂时联系不上。';
          that.setData({
            messages: that.data.messages.concat([withId('assistant', fallback)]),
            loading: false,
            scrollIntoView: 'bottom'
          });
        }
      },
      fail: function () {
        const fallback = '云端教练暂时联系不上（请确认已开通云开发并部署 aiChat 云函数）。先把今天吃了啥、练了啥告诉我，我用本地规则帮你看。';
        that.setData({
          messages: that.data.messages.concat([withId('assistant', fallback)]),
          loading: false,
          scrollIntoView: 'bottom'
        });
      }
    });
  }
});