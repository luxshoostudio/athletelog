// 精选中文食物库（每 100g / 100ml 的营养成分，标准参考估值）
// 字段：name 名称；protein/fat/carbs/calories 每 100g；unit 默认单位；unitGrams 该单位的克数
const FOOD_DB = [
  // —— 蛋奶豆 ——
  { name: '鸡蛋', protein: 12.6, fat: 9.5, carbs: 0.7, calories: 139, unit: '个', unitGrams: 50 },
  { name: '蛋白', protein: 10.9, fat: 0.2, carbs: 0.7, calories: 52, unit: '个', unitGrams: 33 },
  { name: '鸭蛋', protein: 12.6, fat: 13.0, carbs: 3.1, calories: 180, unit: '个', unitGrams: 65 },
  { name: '牛奶', protein: 3.0, fat: 3.2, carbs: 4.8, calories: 62, unit: '毫升', unitGrams: 1 },
  { name: '低脂牛奶', protein: 3.4, fat: 1.0, carbs: 5.0, calories: 45, unit: '毫升', unitGrams: 1 },
  { name: '酸奶', protein: 3.5, fat: 3.0, carbs: 4.0, calories: 72, unit: '杯', unitGrams: 150 },
  { name: '无糖酸奶', protein: 4.0, fat: 0.4, carbs: 4.5, calories: 40, unit: '杯', unitGrams: 150 },
  { name: '奶酪', protein: 25.0, fat: 33.0, carbs: 1.3, calories: 400, unit: '片', unitGrams: 20 },
  { name: '豆腐', protein: 8.1, fat: 3.7, carbs: 3.0, calories: 76, unit: '克', unitGrams: 100 },
  { name: '豆浆', protein: 3.0, fat: 1.6, carbs: 1.2, calories: 31, unit: '毫升', unitGrams: 1 },

  // —— 肉类 ——
  { name: '鸡胸肉', protein: 24.6, fat: 1.9, carbs: 0.6, calories: 118, unit: '克', unitGrams: 100 },
  { name: '鸡腿肉', protein: 19.0, fat: 11.0, carbs: 0, calories: 181, unit: '克', unitGrams: 100 },
  { name: '鸡翅', protein: 18.0, fat: 16.0, carbs: 0, calories: 216, unit: '个', unitGrams: 40 },
  { name: '鸡胗', protein: 19.2, fat: 2.8, carbs: 0, calories: 118, unit: '克', unitGrams: 100 },
  { name: '瘦牛肉', protein: 20.2, fat: 2.3, carbs: 1.2, calories: 106, unit: '克', unitGrams: 100 },
  { name: '牛腩', protein: 17.0, fat: 29.0, carbs: 0, calories: 332, unit: '克', unitGrams: 100 },
  { name: '牛排', protein: 26.0, fat: 15.0, carbs: 0, calories: 250, unit: '克', unitGrams: 100 },
  { name: '猪里脊', protein: 20.2, fat: 7.9, carbs: 0.7, calories: 155, unit: '克', unitGrams: 100 },
  { name: '五花肉', protein: 9.3, fat: 59.0, carbs: 0, calories: 568, unit: '克', unitGrams: 100 },
  { name: '猪排骨', protein: 18.3, fat: 20.4, carbs: 0, calories: 260, unit: '克', unitGrams: 100 },
  { name: '培根', protein: 13.0, fat: 42.0, carbs: 1.0, calories: 458, unit: '片', unitGrams: 12 },
  { name: '火腿', protein: 16.0, fat: 21.0, carbs: 1.0, calories: 261, unit: '片', unitGrams: 25 },
  { name: '羊肉', protein: 19.0, fat: 14.0, carbs: 0, calories: 203, unit: '克', unitGrams: 100 },
  { name: '鸭肉', protein: 15.5, fat: 19.7, carbs: 0.2, calories: 240, unit: '克', unitGrams: 100 },

  // —— 海鲜 ——
  { name: '三文鱼', protein: 20.0, fat: 13.4, carbs: 0, calories: 208, unit: '克', unitGrams: 100 },
  { name: '金枪鱼', protein: 29.0, fat: 1.0, carbs: 0, calories: 130, unit: '克', unitGrams: 100 },
  { name: '虾', protein: 18.6, fat: 0.8, carbs: 2.8, calories: 93, unit: '克', unitGrams: 100 },
  { name: '鲈鱼', protein: 18.6, fat: 3.4, carbs: 0, calories: 105, unit: '克', unitGrams: 100 },
  { name: '带鱼', protein: 17.7, fat: 4.9, carbs: 3.1, calories: 127, unit: '克', unitGrams: 100 },
  { name: '鱿鱼', protein: 17.0, fat: 1.4, carbs: 3.1, calories: 92, unit: '克', unitGrams: 100 },
  { name: '扇贝', protein: 11.1, fat: 0.6, carbs: 2.6, calories: 60, unit: '克', unitGrams: 100 },

  // —— 主食 ——
  { name: '米饭', protein: 2.6, fat: 0.3, carbs: 25.9, calories: 116, unit: '碗', unitGrams: 200 },
  { name: '糙米饭', protein: 2.7, fat: 0.9, carbs: 23.5, calories: 112, unit: '碗', unitGrams: 200 },
  { name: '馒头', protein: 7.0, fat: 1.1, carbs: 47.0, calories: 223, unit: '个', unitGrams: 100 },
  { name: '面条', protein: 8.3, fat: 0.7, carbs: 61.9, calories: 286, unit: '碗', unitGrams: 200 },
  { name: '全麦面包', protein: 12.0, fat: 3.5, carbs: 46.0, calories: 250, unit: '片', unitGrams: 40 },
  { name: '白面包', protein: 8.0, fat: 3.2, carbs: 50.0, calories: 266, unit: '片', unitGrams: 40 },
  { name: '燕麦片', protein: 15.0, fat: 6.7, carbs: 66.0, calories: 377, unit: '克', unitGrams: 100 },
  { name: '红薯', protein: 1.4, fat: 0.2, carbs: 20.1, calories: 86, unit: '个', unitGrams: 150 },
  { name: '玉米', protein: 4.0, fat: 1.2, carbs: 22.8, calories: 112, unit: '根', unitGrams: 150 },
  { name: '土豆', protein: 2.0, fat: 0.2, carbs: 17.2, calories: 77, unit: '个', unitGrams: 150 },
  { name: '小米粥', protein: 1.4, fat: 0.3, carbs: 8.4, calories: 46, unit: '碗', unitGrams: 300 },
  { name: '饺子', protein: 7.5, fat: 7.0, carbs: 22.0, calories: 183, unit: '个', unitGrams: 25 },
  { name: '包子', protein: 7.0, fat: 5.0, carbs: 32.0, calories: 200, unit: '个', unitGrams: 80 },

  // —— 蔬菜 ——
  { name: '西兰花', protein: 4.1, fat: 0.6, carbs: 4.3, calories: 36, unit: '克', unitGrams: 100 },
  { name: '菠菜', protein: 2.6, fat: 0.3, carbs: 2.8, calories: 24, unit: '克', unitGrams: 100 },
  { name: '生菜', protein: 1.4, fat: 0.2, carbs: 2.0, calories: 15, unit: '克', unitGrams: 100 },
  { name: '番茄', protein: 0.9, fat: 0.2, carbs: 3.5, calories: 20, unit: '个', unitGrams: 100 },
  { name: '黄瓜', protein: 0.8, fat: 0.2, carbs: 2.9, calories: 16, unit: '根', unitGrams: 150 },
  { name: '胡萝卜', protein: 1.0, fat: 0.2, carbs: 8.8, calories: 39, unit: '根', unitGrams: 100 },
  { name: '蘑菇', protein: 3.1, fat: 0.3, carbs: 3.3, calories: 22, unit: '克', unitGrams: 100 },
  { name: '青椒', protein: 1.0, fat: 0.2, carbs: 4.6, calories: 22, unit: '个', unitGrams: 80 },
  { name: '茄子', protein: 1.1, fat: 0.2, carbs: 4.9, calories: 23, unit: '个', unitGrams: 150 },
  { name: '白菜', protein: 1.5, fat: 0.1, carbs: 2.4, calories: 17, unit: '克', unitGrams: 100 },
  { name: '芹菜', protein: 1.2, fat: 0.2, carbs: 3.3, calories: 16, unit: '克', unitGrams: 100 },
  { name: '洋葱', protein: 1.1, fat: 0.2, carbs: 9.0, calories: 40, unit: '个', unitGrams: 100 },
  { name: '南瓜', protein: 0.7, fat: 0.1, carbs: 5.3, calories: 23, unit: '克', unitGrams: 100 },
  { name: '莲藕', protein: 1.9, fat: 0.2, carbs: 15.2, calories: 70, unit: '克', unitGrams: 100 },

  // —— 水果 ——
  { name: '苹果', protein: 0.2, fat: 0.2, carbs: 13.5, calories: 52, unit: '个', unitGrams: 200 },
  { name: '香蕉', protein: 1.4, fat: 0.2, carbs: 22.0, calories: 93, unit: '根', unitGrams: 100 },
  { name: '橙子', protein: 0.8, fat: 0.2, carbs: 11.1, calories: 48, unit: '个', unitGrams: 150 },
  { name: '蓝莓', protein: 0.7, fat: 0.3, carbs: 14.5, calories: 57, unit: '克', unitGrams: 100 },
  { name: '草莓', protein: 0.7, fat: 0.3, carbs: 7.7, calories: 32, unit: '克', unitGrams: 100 },
  { name: '西瓜', protein: 0.6, fat: 0.2, carbs: 5.8, calories: 26, unit: '克', unitGrams: 100 },
  { name: '葡萄', protein: 0.5, fat: 0.2, carbs: 17.0, calories: 69, unit: '克', unitGrams: 100 },
  { name: '猕猴桃', protein: 0.8, fat: 0.6, carbs: 14.5, calories: 61, unit: '个', unitGrams: 90 },
  { name: '梨', protein: 0.4, fat: 0.1, carbs: 13.1, calories: 50, unit: '个', unitGrams: 200 },
  { name: '桃子', protein: 0.9, fat: 0.1, carbs: 12.2, calories: 51, unit: '个', unitGrams: 150 },
  { name: '芒果', protein: 0.8, fat: 0.4, carbs: 14.0, calories: 60, unit: '个', unitGrams: 200 },
  { name: '牛油果', protein: 2.0, fat: 15.0, carbs: 9.0, calories: 160, unit: '个', unitGrams: 150 },
  { name: '柠檬', protein: 1.1, fat: 0.3, carbs: 6.2, calories: 29, unit: '个', unitGrams: 100 },

  // —— 坚果零食 ——
  { name: '花生', protein: 24.8, fat: 44.3, carbs: 21.7, calories: 563, unit: '克', unitGrams: 100 },
  { name: '核桃', protein: 14.9, fat: 58.8, carbs: 19.1, calories: 646, unit: '个', unitGrams: 10 },
  { name: '杏仁', protein: 21.3, fat: 50.6, carbs: 19.7, calories: 578, unit: '克', unitGrams: 100 },
  { name: '腰果', protein: 17.3, fat: 36.7, carbs: 41.6, calories: 559, unit: '克', unitGrams: 100 },
  { name: '瓜子', protein: 22.6, fat: 52.8, carbs: 12.5, calories: 606, unit: '克', unitGrams: 100 },
  { name: '巧克力', protein: 4.3, fat: 30.0, carbs: 59.0, calories: 546, unit: '块', unitGrams: 15 },
  { name: '饼干', protein: 6.0, fat: 20.0, carbs: 68.0, calories: 480, unit: '片', unitGrams: 10 },
  { name: '薯片', protein: 6.0, fat: 33.0, carbs: 53.0, calories: 540, unit: '克', unitGrams: 100 },
  { name: '蛋糕', protein: 6.0, fat: 20.0, carbs: 45.0, calories: 380, unit: '块', unitGrams: 80 },

  // —— 饮料 ——
  { name: '蛋白粉', protein: 80.0, fat: 5.0, carbs: 7.0, calories: 380, unit: '勺', unitGrams: 30 },
  { name: '黑咖啡', protein: 0.3, fat: 0, carbs: 0.3, calories: 2, unit: '杯', unitGrams: 250 },
  { name: '拿铁', protein: 2.5, fat: 3.5, carbs: 4.5, calories: 60, unit: '杯', unitGrams: 300 },
  { name: '可乐', protein: 0, fat: 0, carbs: 10.6, calories: 43, unit: '毫升', unitGrams: 1 },
  { name: '果汁', protein: 0.3, fat: 0.1, carbs: 11.0, calories: 45, unit: '杯', unitGrams: 250 },
  { name: '啤酒', protein: 0.5, fat: 0, carbs: 3.5, calories: 43, unit: '毫升', unitGrams: 1 },
  { name: '红酒', protein: 0.1, fat: 0, carbs: 2.6, calories: 83, unit: '杯', unitGrams: 150 },
  { name: '茶', protein: 0, fat: 0, carbs: 0, calories: 1, unit: '杯', unitGrams: 250 },

  // —— 其他 ——
  { name: '米饭配三文鱼', protein: 9.0, fat: 4.5, carbs: 20.0, calories: 155, unit: '份', unitGrams: 300 },
  { name: '鸡胸沙拉', protein: 10.0, fat: 3.0, carbs: 5.0, calories: 90, unit: '份', unitGrams: 300 },
  { name: '牛油果吐司', protein: 6.0, fat: 12.0, carbs: 28.0, calories: 240, unit: '份', unitGrams: 150 },
  { name: '燕麦酸奶碗', protein: 8.0, fat: 5.0, carbs: 25.0, calories: 180, unit: '碗', unitGrams: 250 }
];

function searchFood(query) {
  const q = (query || '').trim();
  if (!q) {
    return FOOD_DB.slice(0, 20);
  }
  const lower = q.toLowerCase();
  return FOOD_DB.filter(function (item) {
    return item.name.indexOf(q) >= 0 || item.name.toLowerCase().indexOf(lower) >= 0;
  }).slice(0, 30);
}

function getFood(name) {
  for (let i = 0; i < FOOD_DB.length; i += 1) {
    if (FOOD_DB[i].name === name) return FOOD_DB[i];
  }
  return null;
}

module.exports = {
  FOOD_DB: FOOD_DB,
  searchFood: searchFood,
  getFood: getFood
};
