Page({
  onLoad: function () {
    setTimeout(function () {
      wx.redirectTo({ url: '/pages/today/index' });
    }, 1200);
  }
});