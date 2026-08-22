App({
  onLaunch: function () {
    if (wx.cloud) {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
    }
  },
  globalData: {
    appName: 'Lux私教笔记'
  }
});
