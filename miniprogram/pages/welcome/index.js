Page({
  onLoad: function () {
    const that = this;
    this._entered = false;
    this._timer = setTimeout(function () {
      that.goToday();
    }, 1600);
  },

  onUnload: function () {
    if (this._timer) {
      clearTimeout(this._timer);
    }
  },

  goToday: function () {
    if (this._entered) return;
    this._entered = true;
    if (this._timer) {
      clearTimeout(this._timer);
    }
    wx.redirectTo({ url: '/pages/today/index' });
  },

  enter: function () {
    this.goToday();
  }
});