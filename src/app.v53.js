(() => {
  window.__RECIPE_SYSTEM_VERSION__ = "V51";
  let rawData = window.RECIPE_DATA || { recipes: [], meta: {} };
  let recipes = Array.isArray(rawData.recipes) ? rawData.recipes : [];
  let meta = rawData.meta || {};
  let dataLoadError = "";
  const safeList = value => Array.isArray(value) ? value : [];
  function storageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); }
    catch { /* 本地预览禁用存储时，忽略即可，不影响页面渲染 */ }
  }
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = {
    keyword: "",
    ingredients: [],
    tastes: [],
    methods: [],
    difficulties: [],
    calorieLevels: [],
    healthTags: [],
    conditions: [],
    allergens: [],
    excludedSeasonings: [],
    scenes: [],
    seasons: [],
    festivals: [],
    minCalories: null,
    maxCalories: null,
    maxMinutes: null,
    sort: "score",
    currentTab: "recipes"
  };

  let homeSlideIndex = 0;

  async function loadDatabaseData() {
    dataLoadError = "";
    if (window.location.protocol === "file:") {
      dataLoadError = "菜谱上传功能需要通过 python server.py 启动，不能直接双击 index.html。";
      return;
    }
    try {
      const resp = await fetch("/api/bootstrap", { cache: "no-store" });
      const payload = await resp.json();
      if (!resp.ok || payload.ok === false) {
        throw new Error(payload.message || `数据库数据加载失败：HTTP ${resp.status}`);
      }
      const nextData = payload.data || payload;
      rawData = nextData || { recipes: [], meta: {} };
      recipes = Array.isArray(rawData.recipes) ? rawData.recipes : [];
      meta = rawData.meta || {};
      if (!recipes.length) {
        dataLoadError = "数据库连接成功，但没有读取到菜谱数据。请先导入初始化 SQL。";
      }
    } catch (error) {
      dataLoadError = error.message || "数据库数据加载失败";
      console.error("数据加载失败：", error);
      if (window.RECIPE_DATA && Array.isArray(window.RECIPE_DATA.recipes)) {
        rawData = window.RECIPE_DATA;
        recipes = window.RECIPE_DATA.recipes;
        meta = window.RECIPE_DATA.meta || {};
      }
    }
  }

  const conditionMap = {
    "高血压": ["降压"],
    "高血糖": ["控糖"],
    "高血脂": ["低脂", "减脂"]
  };

  const allergenGroups = {
    "蛋类": ["鸡蛋", "鸭蛋", "鹌鹑蛋", "蛋"],
    "乳制品": ["牛奶", "奶油", "奶酪", "奶粉", "黄油"],
    "海鲜": ["虾", "蟹", "扇贝", "鲈鱼", "鱼", "鳕鱼", "海带", "紫菜", "贝"],
    "坚果": ["花生", "核桃", "杏仁", "腰果", "芝麻"],
    "豆制品": ["豆腐", "黄豆", "豆浆", "腐竹", "豆皮"],
    "麸质": ["面粉", "面条", "粉丝", "燕麦", "面包", "小麦"],
    "辛辣": ["辣椒", "小米辣", "干辣椒", "花椒", "郫县豆瓣酱", "豆瓣酱"]
  };

  const synonymGroups = [
    ["番茄", "西红柿", "小番茄", "fanqie", "xihongshi", "fq", "xhs"],
    ["土豆", "马铃薯", "洋芋", "tudou", "malingshu", "td"],
    ["黄瓜", "青瓜", "huanggua", "qinggua", "hg", "qg"],
    ["蒜", "大蒜", "蒜头", "蒜蓉", "suan", "dasuan"],
    ["姜", "生姜", "jiang", "shengjiang"],
    ["葱", "小葱", "大葱", "香葱", "葱花", "cong"],
    ["盐", "食盐", "yan", "shiyan"],
    ["糖", "白糖", "冰糖", "白砂糖", "tang", "baitang"],
    ["鸡蛋", "蛋", "鸡旦", "jidan", "dan", "jd"],
    ["鸡胸肉", "鸡胸", "鸡肉", "鸡兄肉", "jixiongrou", "jixiong", "jxr"],
    ["鸡腿肉", "鸡腿", "jitui", "jtr"],
    ["猪排骨", "排骨", "paigu", "zhupaigu", "pg"],
    ["猪里脊", "里脊", "猪肉", "zhurou", "rou", "lijirou"],
    ["牛腩", "牛肉", "niurou", "niunan"],
    ["羊肉", "yangrou"],
    ["鲈鱼", "鱼", "luyu", "yu"],
    ["鲜虾", "虾", "xia", "xianxia"],
    ["扇贝", "shanbei", "sb"],
    ["豆腐", "嫩豆腐", "腐竹", "doufu", "nenndoufu", "fuzhu"],
    ["香菇", "蘑菇", "菌菇", "xianggu", "mogu", "junggu"],
    ["西兰花", "xilanhua", "xlh"],
    ["娃娃菜", "wawacai", "wwc"],
    ["生菜", "shengcai", "sc"],
    ["空心菜", "kongxincai", "kxc"],
    ["芦笋", "lusun", "ls"],
    ["山药", "shanyao", "sy"],
    ["冬瓜", "donggua", "dg"],
    ["小米", "xiaomi", "xm"],
    ["燕麦", "燕麦片", "yanmai", "ym"],
    ["大米", "米饭", "白米饭", "粥", "稀饭", "dami", "mifan", "zhou"],
    ["酸奶", "无糖酸奶", "suannai"],
    ["牛奶", "niunai"],
    ["香蕉", "xiangjiao", "xj"],
    ["香菜", "芫荽", "xiangcai"],
    ["莲藕", "藕", "lianou", "ou"],
    ["玉米", "苞米", "yumi"],
    ["紫薯", "红薯", "zishu", "hongshu"],
    ["清淡", "少油", "不油腻", "qingdan"],
    ["减脂", "减肥", "瘦身", "低脂", "低卡", "jianfei", "jianzhi"],
    ["快手", "省时", "很快", "十分钟", "十五分钟", "kuai", "kuaishou"],
    ["晚餐", "晚饭", "晚上", "wancan"],
    ["午餐", "午饭", "中午", "wucan"],
    ["早餐", "早饭", "早上", "zaocan"]
  ];

  const aliases = synonymGroups.reduce((map, group) => {
    const canonical = group[0];
    group.forEach(term => { map[term] = canonical; });
    return map;
  }, {});

  const packagePresets = {
    office: {
      name: "上班族便当",
      description: "偏向 30 分钟内、低脂低卡、方便携带。",
      scenes: ["午餐", "晚餐", "减脂"],
      health: ["低脂", "低卡", "高蛋白"],
      maxMinutes: 30,
      slots: ["主食", "热菜", "凉菜"]
    },
    fatloss: {
      name: "减脂套餐",
      description: "优先低卡、低脂、高蛋白，控制总热量。",
      scenes: ["减脂"],
      health: ["低脂", "低卡", "高蛋白", "减脂"],
      maxCalories: 150,
      slots: ["热菜", "凉菜", "汤羹"]
    },
    family: {
      name: "家庭正餐",
      description: "兼顾热菜、汤羹、凉菜，适合多人共享。",
      scenes: ["家庭正餐", "晚餐", "聚餐"],
      health: ["滋补", "养胃", "高蛋白"],
      slots: ["热菜", "汤羹", "凉菜"]
    },
    period: {
      name: "生理期滋补",
      description: "偏向温补、养胃、补铁类菜品。",
      scenes: ["生理期", "养生"],
      health: ["经期适用", "滋补", "养胃", "补铁"],
      slots: ["汤羹", "热菜", "甜品"]
    },
    breakfast: {
      name: "早餐套餐",
      description: "偏向早餐、快手、养胃、清淡。",
      scenes: ["早餐"],
      health: ["养胃", "低脂"],
      maxMinutes: 30,
      slots: ["主食", "汤羹", "甜品/早餐", "饮品/早餐"]
    },
    seasonal: {
      name: "时令尝鲜",
      description: "根据当前季节选择应季菜。",
      seasons: [getCurrentSeason()],
      health: ["低脂", "清火", "滋补"],
      slots: ["热菜", "凉菜", "汤羹"]
    }
  };

  function normalizeText(text) {
    return String(text || "").trim().toLowerCase();
  }

  function canonicalIngredient(name) {
    const raw = String(name || "").trim();
    return aliases[raw] || raw;
  }

  function variantsForTerm(term) {
    const raw = String(term || "").trim();
    if (!raw) return [];
    const canonical = aliases[raw] || raw;
    const group = synonymGroups.find(g => g.includes(raw) || g.includes(canonical));
    return Array.from(new Set([raw, canonical, ...(group || [])])).filter(Boolean);
  }


  const semanticAliasGroups = {
    tastes: {
      "清淡": ["清淡", "少油", "不油", "不腻", "淡一点", "清爽", "qingdan"],
      "酸甜": ["酸甜", "开胃", "酸甜口"],
      "酸辣": ["酸辣", "微辣开胃"],
      "麻辣": ["麻辣", "辣", "重口", "香辣"],
      "咸鲜": ["咸鲜", "鲜一点", "鲜味"],
      "香甜": ["香甜", "甜口", "甜一点"]
    },
    methods: {
      "蒸": ["蒸", "清蒸", "zheng"],
      "炒": ["炒", "小炒", "快炒", "chao"],
      "煮": ["煮", "水煮", "zhu"],
      "炖": ["炖", "煲", "慢炖", "dun"],
      "凉拌": ["凉拌", "拌", "冷菜", "凉菜"],
      "煎": ["煎", "香煎"],
      "烤": ["烤", "烤箱"],
      "焖": ["焖"],
      "烧": ["烧", "红烧"]
    },
    scenes: {
      "早餐": ["早餐", "早饭", "早上", "早晨", "zaocan"],
      "午餐": ["午餐", "午饭", "中午", "wucan"],
      "晚餐": ["晚餐", "晚饭", "晚上", "今晚", "wancan"],
      "减脂": ["减脂", "减肥", "瘦身", "控卡", "轻食"],
      "养生": ["养生", "滋补", "调理"],
      "家庭正餐": ["家庭", "家常", "一家人", "正餐"],
      "朋友聚餐": ["聚餐", "朋友", "宴客", "多人"]
    },
    health: {
      "低脂": ["低脂", "少油", "不油", "减脂", "减肥"],
      "低卡": ["低卡", "低热量", "少热量", "控卡", "减脂"],
      "高蛋白": ["高蛋白", "补蛋白", "蛋白质"],
      "控糖": ["控糖", "血糖", "高血糖", "糖尿病"],
      "降压": ["降压", "血压", "高血压"],
      "养胃": ["养胃", "胃不舒服", "好消化"],
      "滋补": ["滋补", "补一补", "温补"],
      "清火": ["清火", "上火", "去火", "降火"],
      "经期适用": ["经期", "生理期", "姨妈期"],
      "补铁": ["补铁", "贫血"],
      "高纤维": ["高纤维", "膳食纤维", "通便"]
    }
  };

  const pinyinAliasRules = [
    ["xihongshi", "西红柿"], ["fanqie", "番茄"], ["jidan", "鸡蛋"], ["chaodan", "炒蛋"], ["dan", "蛋"],
    ["jixiongrou", "鸡胸肉"], ["jixiong", "鸡胸"], ["jxr", "鸡胸肉"], ["huanggua", "黄瓜"], ["qinggua", "黄瓜"],
    ["tudou", "土豆"], ["malingshu", "土豆"], ["doufu", "豆腐"], ["fuzhu", "腐竹"], ["paigu", "排骨"],
    ["niurou", "牛肉"], ["niunan", "牛腩"], ["yangrou", "羊肉"], ["luyu", "鲈鱼"], ["yu", "鱼"],
    ["xia", "虾"], ["shanbei", "扇贝"], ["xilanhua", "西兰花"], ["wawacai", "娃娃菜"], ["shengcai", "生菜"],
    ["kongxincai", "空心菜"], ["lusun", "芦笋"], ["shanyao", "山药"], ["donggua", "冬瓜"], ["xianggu", "香菇"],
    ["xiaomi", "小米"], ["yanmai", "燕麦"], ["dami", "大米"], ["suannai", "酸奶"], ["niunai", "牛奶"],
    ["xiangjiao", "香蕉"], ["qingdan", "清淡"], ["jianzhi", "减脂"], ["jianfei", "减脂"], ["kuaishou", "快手"],
    ["zaocan", "早餐"], ["wucan", "午餐"], ["wancan", "晚餐"], ["zheng", "蒸"], ["chao", "炒"], ["zhu", "煮"], ["dun", "炖"]
  ];

  const queryCache = new Map();
  let knownTermCache = null;
  const nutritionCache = new Map();

  const ingredientNutrition = {
    "番茄": { kcal: 18, protein: 0.9, fat: 0.2, carb: 3.9 }, "西红柿": { kcal: 18, protein: 0.9, fat: 0.2, carb: 3.9 },
    "鸡蛋": { kcal: 143, protein: 13, fat: 10, carb: 1.1 }, "鸡胸肉": { kcal: 165, protein: 31, fat: 3.6, carb: 0 },
    "鸡腿肉": { kcal: 181, protein: 18, fat: 12, carb: 0 }, "鸡肉": { kcal: 180, protein: 20, fat: 10, carb: 0 },
    "猪排骨": { kcal: 278, protein: 17, fat: 23, carb: 0 }, "猪肉末": { kcal: 260, protein: 17, fat: 20, carb: 0 }, "猪里脊": { kcal: 155, protein: 21, fat: 7, carb: 0 },
    "牛腩": { kcal: 332, protein: 18, fat: 29, carb: 0 }, "牛肉末": { kcal: 250, protein: 20, fat: 18, carb: 0 }, "羊肉": { kcal: 203, protein: 19, fat: 14, carb: 0 },
    "鲈鱼": { kcal: 105, protein: 18.6, fat: 3.4, carb: 0 }, "鲜虾": { kcal: 99, protein: 20, fat: 1.5, carb: 0.2 }, "扇贝": { kcal: 88, protein: 17, fat: 0.8, carb: 2.4 },
    "嫩豆腐": { kcal: 84, protein: 8, fat: 4.8, carb: 2.7 }, "豆腐": { kcal: 84, protein: 8, fat: 4.8, carb: 2.7 }, "干腐竹": { kcal: 459, protein: 44, fat: 22, carb: 21 },
    "黄瓜": { kcal: 16, protein: 0.8, fat: 0.2, carb: 3.6 }, "冬瓜": { kcal: 11, protein: 0.4, fat: 0.1, carb: 2.6 }, "西兰花": { kcal: 34, protein: 2.8, fat: 0.4, carb: 6.6 },
    "生菜": { kcal: 16, protein: 1.4, fat: 0.2, carb: 2.9 }, "空心菜": { kcal: 20, protein: 2.2, fat: 0.3, carb: 3.6 }, "娃娃菜": { kcal: 13, protein: 1.5, fat: 0.1, carb: 2.4 },
    "芦笋": { kcal: 22, protein: 2.4, fat: 0.2, carb: 4.1 }, "茼蒿": { kcal: 24, protein: 1.9, fat: 0.3, carb: 3.9 }, "芥兰": { kcal: 19, protein: 1.8, fat: 0.3, carb: 3.1 },
    "土豆": { kcal: 77, protein: 2, fat: 0.1, carb: 17 }, "莲藕": { kcal: 74, protein: 2.6, fat: 0.1, carb: 17 }, "胡萝卜": { kcal: 41, protein: 0.9, fat: 0.2, carb: 10 },
    "山药": { kcal: 57, protein: 1.9, fat: 0.2, carb: 12.4 }, "紫薯": { kcal: 82, protein: 1.7, fat: 0.1, carb: 19 }, "香蕉": { kcal: 89, protein: 1.1, fat: 0.3, carb: 23 },
    "大米": { kcal: 346, protein: 7.4, fat: 0.8, carb: 77 }, "糙米": { kcal: 348, protein: 7.7, fat: 2.7, carb: 76 }, "小米": { kcal: 361, protein: 9, fat: 3.1, carb: 75 },
    "燕麦": { kcal: 389, protein: 16.9, fat: 6.9, carb: 66 }, "燕麦片": { kcal: 389, protein: 16.9, fat: 6.9, carb: 66 }, "全麦面粉": { kcal: 340, protein: 13, fat: 2.5, carb: 72 }, "低筋面粉": { kcal: 350, protein: 8, fat: 1.5, carb: 76 },
    "牛奶": { kcal: 54, protein: 3.2, fat: 3.2, carb: 5 }, "无糖酸奶": { kcal: 62, protein: 3.5, fat: 3.3, carb: 4.7 }, "酸奶": { kcal: 72, protein: 3.2, fat: 3.5, carb: 7 },
    "白砂糖": { kcal: 400, protein: 0, fat: 0, carb: 100 }, "白糖": { kcal: 400, protein: 0, fat: 0, carb: 100 }, "冰糖": { kcal: 397, protein: 0, fat: 0, carb: 99 },
    "无盐黄油": { kcal: 717, protein: 0.9, fat: 81, carb: 0.1 }, "淡奶油": { kcal: 340, protein: 2, fat: 35, carb: 3 }, "香油": { kcal: 900, protein: 0, fat: 100, carb: 0 }, "茶油": { kcal: 900, protein: 0, fat: 100, carb: 0 }
  };

  const typeNutritionFallback = {
    "蔬菜类": { kcal: 30, protein: 1.5, fat: 0.2, carb: 6 },
    "肉蛋类": { kcal: 180, protein: 18, fat: 10, carb: 1 },
    "水产类": { kcal: 105, protein: 18, fat: 2, carb: 1 },
    "主食类": { kcal: 300, protein: 8, fat: 2, carb: 65 },
    "豆制品": { kcal: 95, protein: 9, fat: 5, carb: 4 },
    "菌菇类": { kcal: 28, protein: 2.5, fat: 0.3, carb: 5 },
    "调味料类": { kcal: 80, protein: 1, fat: 2, carb: 10 }
  };

  const pieceWeights = [
    [/鸡蛋|鸭蛋|鹌鹑蛋/, { "个": 55 }], [/番茄|西红柿/, { "个": 180 }], [/小番茄/, { "个": 18 }],
    [/黄瓜/, { "根": 180, "个": 180 }], [/胡萝卜/, { "根": 120, "个": 120 }], [/土豆/, { "个": 200 }], [/洋葱/, { "个": 180 }],
    [/山药/, { "根": 250 }], [/香蕉/, { "根": 120 }], [/娃娃菜|生菜/, { "颗": 200 }], [/西兰花/, { "朵": 300 }],
    [/香菇/, { "朵": 15, "个": 15 }], [/扇贝/, { "只": 45 }], [/虾/, { "只": 20, "个": 20 }], [/鲈鱼/, { "条": 500 }],
    [/排骨|羊肉|牛腩|乌鸡|鸡肉/, { "只": 500, "半只": 500, "块": 200 }], [/蒜|大蒜/, { "瓣": 5, "头": 50 }],
    [/姜|生姜/, { "片": 5 }], [/葱/, { "根": 20 }], [/小米辣|辣椒|干辣椒/, { "个": 8, "根": 8 }],
    [/芦笋|茼蒿|空心菜|菠菜|芥兰|春笋/, { "把": 200, "根": 60 }], [/莲藕/, { "节": 200 }], [/红枣/, { "个": 8 }]
  ];

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function uniqueById(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const id = item && item.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function normalizeSearchText(text) {
    return normalizeText(text).replace(/[\s·，,。！？!?、/；;：:（）()【】\[\]"'“”‘’]+/g, "");
  }

  function expandQueryText(text) {
    const raw = normalizeText(text);
    const hits = [];
    pinyinAliasRules.forEach(([latin, cn]) => {
      const escaped = latin;
      const hit = latin.length <= 3
        ? new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(raw)
        : raw.includes(latin);
      if (hit) hits.push(cn);
    });
    return `${raw} ${hits.join(" ")}`.trim();
  }

  function knownSearchTerms() {
    if (knownTermCache) return knownTermCache;
    const terms = [];
    recipes.forEach(r => {
      terms.push(r.name, r.category, r.taste, r.method, r.difficulty, r.calorieLevel);
      terms.push(...safeList(r.healthTags), ...safeList(r.seasons), ...safeList(r.scenes), ...safeList(r.festivals));
      terms.push(...safeList(r.ingredients).map(i => i.name));
    });
    Object.values(meta).forEach(v => { if (Array.isArray(v)) terms.push(...v); });
    synonymGroups.forEach(group => terms.push(...group));
    knownTermCache = unique(terms.map(t => String(t || "").trim()).filter(Boolean)).sort((a, b) => b.length - a.length);
    return knownTermCache;
  }

  function textHasTerm(text, term) {
    const rawFull = normalizeText(text);
    const expandedFull = normalizeText(expandQueryText(text));
    const raw = normalizeSearchText(text);
    const expanded = normalizeSearchText(expandQueryText(text));
    return variantsForTerm(term).some(v => {
      const n = normalizeSearchText(v);
      if (!n) return false;
      if (/^[a-z]+$/.test(n) && n.length <= 3) {
        const shortPattern = new RegExp(`(^|[^a-z])${n}([^a-z]|$)`, "i");
        return shortPattern.test(rawFull) || shortPattern.test(expandedFull);
      }
      return raw.includes(n) || expanded.includes(n);
    });
  }

  function levenshtein(a, b) {
    a = normalizeSearchText(a); b = normalizeSearchText(b);
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[a.length][b.length];
  }

  function fuzzyClose(a, b) {
    const x = normalizeSearchText(a);
    const y = normalizeSearchText(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.includes(y) || y.includes(x)) {
      const latinShort = /^[a-z]+$/.test(x + y) && Math.min(x.length, y.length) <= 3;
      return !latinShort && Math.min(x.length, y.length) >= 2;
    }
    if (x.length < 2 || y.length < 2) return false;
    const dist = levenshtein(x, y);
    const maxLen = Math.max(x.length, y.length);
    if (maxLen <= 3) return dist <= 1;
    if (maxLen <= 5) return dist <= 1;
    return dist <= 2 && dist / maxLen <= 0.34;
  }

  function recipeSearchTerms(recipe) {
    const ingredientTerms = safeList(recipe.ingredients).flatMap(i => variantsForTerm(i.name));
    return unique([
      recipe.id, recipe.name, recipe.category, recipe.taste, recipe.method, recipe.difficulty, recipe.calorieLevel,
      ...safeList(recipe.healthTags), ...safeList(recipe.seasons), ...safeList(recipe.scenes), ...safeList(recipe.festivals),
      ...safeList(recipe.ingredients).map(i => i.name), ...ingredientTerms
    ].map(t => String(t || "").trim()).filter(Boolean));
  }

  function tokenFuzzyMatchesRecipe(recipe, token) {
    const clean = normalizeSearchText(token);
    if (!clean || clean.length < 2) return false;
    if (/^[\u4e00-\u9fff]+$/.test(clean) && clean.length < 3) return false;
    if (/^[a-z]+$/.test(clean) && clean.length < 5) return false;
    return recipeSearchTerms(recipe).some(term => {
      if (fuzzyClose(clean, term)) return true;
      return variantsForTerm(term).some(v => fuzzyClose(clean, v));
    });
  }

  function parseLooseNumber(text) {
    const s = String(text || "");
    const digit = s.match(/(\d+(?:\.\d+)?)/);
    if (digit) return Number(digit[1]);
    const map = { "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
    const m = s.match(/[一二两三四五六七八九十]+/);
    if (!m) return null;
    const w = m[0];
    if (w === "十") return 10;
    if (w.includes("十")) {
      const [a, b] = w.split("十");
      return (a ? map[a] : 1) * 10 + (b ? map[b] : 0);
    }
    return map[w] ?? null;
  }

  function extractMinutesFromQuery(q) {
    const text = String(q || "");
    const minuteMatch = text.match(/([\d一二两三四五六七八九十]+)\s*(?:分钟|min|mins|分钟内|分钟以内)/i);
    let value = minuteMatch ? parseLooseNumber(minuteMatch[1]) : null;
    if (!value && /快手|很快|省时|下班|没时间|懒人/.test(text)) value = 20;
    const hard = /内|以内|不超过|最多|少于|小于|控制在/.test(text);
    return { value, hard };
  }

  function extractCaloriesFromQuery(q) {
    const text = String(q || "");
    const m = text.match(/(\d+)\s*(?:千卡|卡|kcal|大卡)(?:以内|以下|内|左右)?/i);
    if (!m) return { max: null, hard: false };
    return { max: Number(m[1]), hard: /内|以内|以下|不超过|最多|控制/.test(text) };
  }

  function collectByAliases(query, options, groupAliases = {}) {
    const expanded = expandQueryText(query);
    return unique((options || []).filter(opt => {
      if (textHasTerm(expanded, opt)) return true;
      const aliases = (groupAliases[opt] || []).concat(variantsForTerm(opt));
      return aliases.some(alias => textHasTerm(expanded, alias));
    }));
  }

  function extractQuerySignals(query) {
    const original = String(query || "").trim();
    if (!original) return emptySignals();
    const cacheKey = original;
    if (queryCache.has(cacheKey)) return queryCache.get(cacheKey);
    const expanded = expandQueryText(original);
    const lowerExpanded = normalizeText(expanded);

    const tokens = splitKeyword(original);
    const ingredients = collectByAliases(expanded, safeList(meta.ingredients));
    knownSearchTerms().forEach(term => {
      if (term && /[\u4e00-\u9fff]/.test(term) && textHasTerm(expanded, term)) {
        if (safeList(meta.ingredients).includes(term)) ingredients.push(term);
      }
    });
    tokens.forEach(token => {
      const cleanToken = normalizeSearchText(token);
      if (cleanToken.length < 3) return;
      if (/^[a-z]+$/.test(cleanToken) && cleanToken.length <= 4) return;
      safeList(meta.ingredients).forEach(ing => {
        if (fuzzyClose(token, ing) || variantsForTerm(ing).some(v => fuzzyClose(token, v))) ingredients.push(ing);
      });
    });

    const tastes = collectByAliases(expanded, safeList(meta.tastes), semanticAliasGroups.tastes);
    const methods = collectByAliases(expanded, safeList(meta.methods), semanticAliasGroups.methods);
    const scenes = collectByAliases(expanded, safeList(meta.scenes), semanticAliasGroups.scenes);
    const health = collectByAliases(expanded, safeList(meta.healthTags), semanticAliasGroups.health);
    const seasons = collectByAliases(expanded, safeList(meta.seasons));
    const festivals = collectByAliases(expanded, safeList(meta.festivals));
    const categories = collectByAliases(expanded, safeList(meta.categories || []));
    const calorieLevels = collectByAliases(expanded, safeList(meta.calorieLevels || []));

    if (/减脂|减肥|瘦身|低脂|低卡|控卡|低热量/.test(lowerExpanded)) health.push("减脂", "低脂", "低卡");
    if (/清淡|清爽|少油|不油腻|淡一点|qingdan/.test(lowerExpanded)) tastes.push("清淡");
    if (/快手|很快|省时|下班|没时间|懒人/.test(lowerExpanded)) scenes.push("家常便饭");
    if (/晚餐|晚饭|晚上|今晚|wancan/.test(lowerExpanded)) scenes.push("晚餐");
    if (/午餐|午饭|中午|wucan/.test(lowerExpanded)) scenes.push("午餐");
    if (/早餐|早饭|早上|zaocan/.test(lowerExpanded)) scenes.push("早餐");
    if (/高血压|血压|降压/.test(lowerExpanded)) health.push("降压");
    if (/高血糖|血糖|控糖|糖尿病/.test(lowerExpanded)) health.push("控糖");
    if (/高血脂|血脂/.test(lowerExpanded)) health.push("低脂");

    const time = extractMinutesFromQuery(lowerExpanded);
    const calories = extractCaloriesFromQuery(lowerExpanded);
    const excludedIngredients = [];
    if (/不要|不吃|忌口|排除|过敏|不能吃|别放/.test(lowerExpanded)) {
      safeList(meta.ingredients).forEach(ing => {
        if (textHasTerm(expanded, ing) && new RegExp(`(不要|不吃|忌口|排除|过敏|不能吃|别放).{0,6}${ing}|${ing}.{0,6}(不要|不吃|忌口|排除|过敏|不能吃|别放)`).test(original)) {
          excludedIngredients.push(ing);
        }
      });
    }

    const signals = {
      raw: original,
      expanded,
      tokens,
      ingredients: unique(ingredients),
      tastes: unique(tastes),
      methods: unique(methods),
      scenes: unique(scenes),
      health: unique(health),
      seasons: unique(seasons),
      festivals: unique(festivals),
      categories: unique(categories),
      calorieLevels: unique(calorieLevels),
      excludedIngredients: unique(excludedIngredients),
      maxMinutes: time.value,
      hardMaxMinutes: time.hard,
      maxCalories: calories.max,
      hardMaxCalories: calories.hard
    };
    queryCache.set(cacheKey, signals);
    return signals;
  }

  function emptySignals() {
    return { raw: "", expanded: "", tokens: [], ingredients: [], tastes: [], methods: [], scenes: [], health: [], seasons: [], festivals: [], categories: [], calorieLevels: [], excludedIngredients: [], maxMinutes: null, hardMaxMinutes: false, maxCalories: null, hardMaxCalories: false };
  }

  function semanticScoreForRecipe(recipe, signals, query) {
    if (!signals || !signals.raw) return 0;
    if (signals.excludedIngredients.some(ing => includesIngredient(recipe, ing))) return -999;
    let score = 0;
    const terms = recipeSearchTerms(recipe);
    signals.ingredients.forEach(ing => { if (includesIngredient(recipe, ing)) score += 42; });
    signals.tastes.forEach(taste => { if (recipe.taste === taste || textHasTerm(recipe.taste, taste)) score += 24; });
    signals.methods.forEach(method => { if (recipe.method === method || recipe.name.includes(method)) score += 20; });
    signals.health.forEach(tag => { if (recipe.healthTags.includes(tag)) score += 20; });
    signals.scenes.forEach(scene => { if (recipe.scenes.includes(scene)) score += 16; });
    signals.seasons.forEach(season => { if (recipe.seasons.includes(season) || recipe.seasons.includes("四季通用") || recipe.seasons.includes("全年")) score += 10; });
    signals.festivals.forEach(f => { if (recipe.festivals.includes(f) || recipe.scenes.includes(f)) score += 10; });
    signals.categories.forEach(c => { if (recipe.category.includes(c)) score += 12; });
    signals.calorieLevels.forEach(c => { if (recipe.calorieLevel === c) score += 12; });
    if (signals.maxMinutes) {
      if (recipe.minutes && recipe.minutes <= signals.maxMinutes) score += 24;
      else if (!signals.hardMaxMinutes && recipe.minutes && recipe.minutes <= signals.maxMinutes + 10) score += 9;
      else if (signals.hardMaxMinutes && recipe.minutes && recipe.minutes > signals.maxMinutes) score -= 22;
    }
    if (signals.maxCalories) {
      const perServing = getRecipeNutrition(recipe).perServingCalories || recipe.calories || 0;
      if (perServing && perServing <= signals.maxCalories) score += 20;
      else if (!signals.hardMaxCalories && perServing <= signals.maxCalories + 80) score += 6;
      else if (signals.hardMaxCalories && perServing > signals.maxCalories) score -= 18;
    }
    signals.tokens.forEach(token => {
      if (terms.some(term => textHasTerm(term, token) || textHasTerm(token, term))) score += 6;
      else if (tokenFuzzyMatchesRecipe(recipe, token)) score += 14;
    });
    return score;
  }

  function nutritionProfileForIngredient(item) {
    const name = String(item?.name || "");
    const direct = ingredientNutrition[name];
    if (direct) return direct;
    const aliasKey = canonicalIngredient(name);
    if (ingredientNutrition[aliasKey]) return ingredientNutrition[aliasKey];
    const matchedKey = Object.keys(ingredientNutrition).find(k => name.includes(k) || k.includes(name));
    if (matchedKey) return ingredientNutrition[matchedKey];
    return typeNutritionFallback[item?.type] || typeNutritionFallback["蔬菜类"];
  }

  function amountNumber(amount) {
    const str = String(amount || "");
    const frac = str.match(/(\d+)\s*\/\s*(\d+)/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    if (/半/.test(str)) return 0.5;
    const n = str.match(/(\d+(?:\.\d+)?)/);
    if (n) return Number(n[1]);
    const cn = parseLooseNumber(str);
    return cn || 1;
  }

  function estimateIngredientGrams(item) {
    const amount = String(item?.amount || "");
    const name = String(item?.name || "");
    if (!amount || /可选/.test(amount)) return 0;
    const gramsInParen = amount.match(/约\s*(\d+(?:\.\d+)?)\s*(?:g|克)/i);
    if (gramsInParen) return Number(gramsInParen[1]);
    const gram = amount.match(/(\d+(?:\.\d+)?)\s*(?:g|克)/i);
    if (gram) return Number(gram[1]);
    const ml = amount.match(/(\d+(?:\.\d+)?)\s*(?:ml|毫升)/i);
    if (ml) return Number(ml[1]);
    if (/适量|少许/.test(amount)) return /盐|胡椒|花椒|椒盐|酵母|泡打粉/.test(name) ? 2 : 5;
    const qty = amountNumber(amount);
    if (/汤匙|大勺|勺/.test(amount)) return qty * (/油|奶油|黄油|酱|糖|蜂蜜|炼乳/.test(name) ? 15 : 10);
    if (/茶匙|小勺/.test(amount)) return qty * 5;
    for (const [pattern, units] of pieceWeights) {
      if (!pattern.test(name)) continue;
      if (/半只/.test(amount) && units["半只"]) return units["半只"];
      for (const [unit, weight] of Object.entries(units)) {
        if (amount.includes(unit)) return qty * weight;
      }
    }
    if (/把/.test(amount)) return qty * 180;
    if (/根/.test(amount)) return qty * 120;
    if (/个|颗|只|条|块|盒|朵|节|头/.test(amount)) return qty * 100;
    if (/片/.test(amount)) return qty * 5;
    if (/瓣/.test(amount)) return qty * 5;
    if (/主料/.test(item?.role || "")) return 150;
    if (/辅料/.test(item?.role || "")) return 30;
    return 5;
  }

  function inferServings(recipe, totalGrams) {
    const cat = String(recipe.category || "");
    const scenes = safeList(recipe.scenes).join(" ");
    if (totalGrams >= 900 || /汤|羹|聚餐|家庭正餐/.test(cat + scenes)) return 3;
    if ((/饮品|早餐|甜品|小吃/.test(cat) || /早餐|下午茶|加餐/.test(scenes)) && totalGrams < 400) return 1;
    return 2;
  }

  function getRecipeNutrition(recipe) {
    if (!recipe) return { totalGrams: 0, totalCalories: 0, perServingCalories: 0, servings: 1, protein: 0, fat: 0, carb: 0, confidence: "low" };
    if (nutritionCache.has(recipe.id)) return nutritionCache.get(recipe.id);
    let totalGrams = 0, totalCalories = 0, protein = 0, fat = 0, carb = 0, estimatedItems = 0;
    safeList(recipe.ingredients).forEach(item => {
      const grams = estimateIngredientGrams(item);
      if (grams > 0) estimatedItems += 1;
      const profile = nutritionProfileForIngredient(item);
      totalGrams += grams;
      totalCalories += grams * (profile.kcal || 0) / 100;
      protein += grams * (profile.protein || 0) / 100;
      fat += grams * (profile.fat || 0) / 100;
      carb += grams * (profile.carb || 0) / 100;
    });
    if (!totalGrams && recipe.calories) totalGrams = 200;
    if (totalCalories < 1 && recipe.calories && totalGrams) totalCalories = recipe.calories * totalGrams / 100;
    const servings = inferServings(recipe, totalGrams);
    const result = {
      totalGrams: Math.round(totalGrams),
      totalCalories: Math.round(totalCalories),
      perServingCalories: Math.round(totalCalories / Math.max(servings, 1)),
      servings,
      protein: Math.round(protein),
      fat: Math.round(fat),
      carb: Math.round(carb),
      confidence: estimatedItems >= Math.max(2, Math.ceil(safeList(recipe.ingredients).length / 2)) ? "medium" : "low"
    };
    nutritionCache.set(recipe.id, result);
    return result;
  }

  function nutritionText(recipe, mode = "serving") {
    const n = getRecipeNutrition(recipe);
    if (mode === "total") return `整菜约${n.totalCalories}千卡`;
    return `每份约${n.perServingCalories}千卡`;
  }

  function splitKeyword(keyword) {
    const raw = String(keyword || "").trim();
    if (!raw) return [];
    const expanded = expandQueryText(raw);
    const parts = [];
    [raw, expanded].forEach(text => {
      String(text || "")
        .split(/[\s，,、/；;。！？!?：:]+/)
        .forEach(chunk => {
          const matched = chunk.match(/[a-zA-Z]+|\d+|[\u4e00-\u9fff]+/g) || [];
          matched.forEach(t => parts.push(t));
        });
    });
    const compact = normalizeSearchText(expanded);
    knownSearchTerms().forEach(term => {
      const n = normalizeSearchText(term);
      if (!n || n.length < 2) return;
      if (/^[a-z]+$/.test(n) && n.length <= 3) return;
      if (compact.includes(n)) parts.push(term);
    });
    return unique(parts.map(t => String(t || "").trim()).filter(Boolean));
  }

  function keywordMatchesRecipe(recipe, keyword) {
    const key = String(keyword || "").trim();
    if (!key) return true;
    const hay = recipeHaystack(recipe);
    const parts = splitKeyword(key).filter(t => normalizeSearchText(t).length >= 2 || /[a-zA-Z]/.test(t));
    const exactTokenHit = parts.some(part => {
      const variants = variantsForTerm(part);
      return variants.some(v => hay.includes(normalizeSearchText(v))) || hay.includes(normalizeSearchText(part));
    });
    const allImportantTokensMatch = parts.length > 1 && parts
      .filter(part => !/想|吃|点|的|我|要|最好|可以|有没有|什么|推荐|左右/.test(part))
      .every(part => {
        const variants = variantsForTerm(part);
        return variants.some(v => hay.includes(normalizeSearchText(v))) || hay.includes(normalizeSearchText(part)) || tokenFuzzyMatchesRecipe(recipe, part);
      });
    const signals = extractQuerySignals(key);
    const semantic = semanticScoreForRecipe(recipe, signals, key);
    return exactTokenHit || allImportantTokensMatch || semantic > 0;
  }

  function includesIngredient(recipe, ingredient) {
    const target = canonicalIngredient(ingredient);
    const targetVariants = variantsForTerm(target).map(normalizeSearchText);
    return safeList(recipe.ingredients).some(item => {
      const n = item.name;
      const cn = canonicalIngredient(n);
      const names = variantsForTerm(n).concat(variantsForTerm(cn)).map(normalizeSearchText);
      const rawTarget = normalizeSearchText(ingredient);
      return names.some(name =>
        name.includes(normalizeSearchText(target)) || normalizeSearchText(target).includes(name) ||
        targetVariants.some(v => {
          const shortLatin = /^[a-z]+$/.test(v + name) && Math.min(v.length, name.length) <= 3;
          return !shortLatin && (name.includes(v) || v.includes(name));
        }) ||
        (rawTarget && (name.includes(rawTarget) || rawTarget.includes(name))) ||
        (rawTarget.length >= 3 && name.length >= 3 && fuzzyClose(rawTarget, name))
      );
    });
  }

  function recipeHaystack(recipe) {
    return recipeSearchTerms(recipe).map(normalizeSearchText).join(" ");
  }

  function scoreRecipe(recipe, keyword) {
    if (!keyword) return 0;
    const signals = extractQuerySignals(keyword);
    const variants = splitKeyword(keyword).flatMap(variantsForTerm);
    let score = Math.max(0, semanticScoreForRecipe(recipe, signals, keyword));
    variants.forEach(term => {
      const key = normalizeSearchText(term);
      if (!key) return;
      if (normalizeSearchText(recipe.name).includes(key)) score += 44;
      if (safeList(recipe.ingredients).some(i => variantsForTerm(i.name).some(v => normalizeSearchText(v).includes(key) || key.includes(normalizeSearchText(v))))) score += 28;
      if (safeList(recipe.healthTags).some(t => normalizeSearchText(t).includes(key))) score += 18;
      if (safeList(recipe.scenes).some(t => normalizeSearchText(t).includes(key))) score += 12;
      if (recipeHaystack(recipe).includes(key)) score += 6;
      if (tokenFuzzyMatchesRecipe(recipe, term)) score += 12;
    });
    if (signals.maxMinutes && recipe.minutes) score += Math.max(0, 14 - Math.max(0, recipe.minutes - signals.maxMinutes));
    const n = getRecipeNutrition(recipe);
    if (/减脂|低卡|低脂|轻食|控卡/.test(signals.expanded) && n.perServingCalories && n.perServingCalories <= 220) score += 10;
    return score;
  }

  function parseNum(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function arrayIntersects(a, b) {
    return a.some(x => b.includes(x));
  }

  function recipeHasExcludedAllergen(recipe, allergen) {
    const terms = allergenGroups[allergen] || [allergen];
    return recipe.ingredients.some(item => terms.some(term => item.name.includes(term)));
  }

  function matchesRecipe(recipe) {
    const keyword = state.keyword.trim();
    const keywordSignals = keyword ? extractQuerySignals(keyword) : emptySignals();
    if (keyword) {
      const semanticScore = semanticScoreForRecipe(recipe, keywordSignals, keyword);
      if (!keywordMatchesRecipe(recipe, keyword) && semanticScore <= 0) return false;
      if (keywordSignals.ingredients.length && !keywordSignals.ingredients.some(ing => includesIngredient(recipe, ing))) return false;
      if (keywordSignals.excludedIngredients.length && keywordSignals.excludedIngredients.some(ing => includesIngredient(recipe, ing))) return false;
      if (keywordSignals.hardMaxMinutes && keywordSignals.maxMinutes && recipe.minutes && recipe.minutes > keywordSignals.maxMinutes) return false;
      if (keywordSignals.hardMaxCalories && keywordSignals.maxCalories && getRecipeNutrition(recipe).perServingCalories > keywordSignals.maxCalories) return false;
    }

    if (state.ingredients.length && !state.ingredients.every(ing => includesIngredient(recipe, ing))) return false;
    if (state.tastes.length && !state.tastes.includes(recipe.taste)) return false;
    if (state.methods.length && !state.methods.includes(recipe.method)) return false;
    if (state.difficulties.length && !state.difficulties.includes(recipe.difficulty)) return false;
    if (state.calorieLevels.length && !state.calorieLevels.includes(recipe.calorieLevel)) return false;
    if (state.healthTags.length && !state.healthTags.some(t => recipe.healthTags.includes(t))) return false;
    if (state.scenes.length && !state.scenes.some(s => recipe.scenes.includes(s))) return false;
    if (state.seasons.length) {
      const seasonMatch = state.seasons.some(s => recipe.seasons.includes(s) || recipe.seasons.includes("四季通用") || recipe.seasons.includes("全年"));
      if (!seasonMatch) return false;
    }
    if (state.festivals.length && !state.festivals.some(f => recipe.festivals.includes(f))) return false;

    const nutrition = getRecipeNutrition(recipe);
    const caloriesForFilter = nutrition.perServingCalories || recipe.calories;
    if (state.minCalories !== null && (caloriesForFilter === null || caloriesForFilter < state.minCalories)) return false;
    if (state.maxCalories !== null && (caloriesForFilter === null || caloriesForFilter > state.maxCalories)) return false;
    if (state.maxMinutes !== null && (recipe.minutes === null || recipe.minutes > state.maxMinutes)) return false;

    if (state.conditions.length) {
      const ok = state.conditions.some(c => arrayIntersects(recipe.healthTags, conditionMap[c] || []));
      if (!ok) return false;
    }

    if (state.allergens.length) {
      const hasAllergen = state.allergens.some(a => recipeHasExcludedAllergen(recipe, a));
      if (hasAllergen) return false;
    }

    if (state.excludedSeasonings.length) {
      const hasExcluded = recipe.ingredients.some(item => {
        return state.excludedSeasonings.some(s => {
          const target = canonicalIngredient(s);
          const name = canonicalIngredient(item.name);
          return name.includes(target) || item.name.includes(s) || s.includes(item.name) || fuzzyClose(s, item.name);
        });
      });
      if (hasExcluded) return false;
    }

    return true;
  }

  function getFilteredRecipes() {
    let result = recipes.filter(matchesRecipe).map(recipe => ({
      ...recipe,
      _score: scoreRecipe(recipe, state.keyword),
      _nutrition: getRecipeNutrition(recipe)
    }));
    const sort = state.sort;
    result.sort((a, b) => {
      if (sort === "calorieAsc") return (a._nutrition.perServingCalories || 9999) - (b._nutrition.perServingCalories || 9999);
      if (sort === "timeAsc") return (a.minutes ?? 9999) - (b.minutes ?? 9999);
      if (sort === "nameAsc") return a.name.localeCompare(b.name, "zh-Hans-CN");
      return (b._score - a._score) || (a.minutes ?? 9999) - (b.minutes ?? 9999) || (a._nutrition.perServingCalories || 9999) - (b._nutrition.perServingCalories || 9999);
    });
    return result;
  }

  function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if ([3, 4, 5].includes(month)) return "春";
    if ([6, 7, 8].includes(month)) return "夏";
    if ([9, 10, 11].includes(month)) return "秋";
    return "冬";
  }

  function iconFor(recipe) {
    if (recipe.category.includes("汤")) return "🥣";
    if (recipe.category.includes("凉")) return "🥗";
    if (recipe.category.includes("甜") || recipe.category.includes("早餐")) return "🍮";
    if (recipe.category.includes("主食")) return "🍚";
    if (recipe.method.includes("蒸")) return "♨️";
    if (recipe.method.includes("烤")) return "🔥";
    return "🍽️";
  }

  function currentMealScene() {
    const hour = new Date().getHours();
    if (hour < 10) return "早餐";
    if (hour < 15) return "午餐";
    return "晚餐";
  }

  function currentFestivalHints() {
    const month = new Date().getMonth() + 1;
    if ([1, 2].includes(month)) return ["春节", "年夜饭", "节日", "家宴"];
    if (month === 6) return ["端午", "节日"];
    if ([9, 10].includes(month)) return ["中秋", "节日", "家宴"];
    return [];
  }

  function scoreForHome(recipe, mode = "today") {
    const season = getCurrentSeason();
    const meal = currentMealScene();
    const festivalHints = currentFestivalHints();
    const name = String(recipe.name || "");
    const category = String(recipe.category || "");
    const taste = String(recipe.taste || "");
    const method = String(recipe.method || "");
    const ingredientText = safeList(recipe.ingredients).map(i => i.name || "").join(" ");
    const text = [name, category, taste, method, ingredientText, safeList(recipe.healthTags).join(" ")].join(" ");

    let score = 0;

    // 1) 基础场景：仍然考虑季节、餐次、节日，但不让它们完全决定首页。
    if (recipe.seasons.includes(season)) score += 14;
    if (recipe.seasons.includes("四季通用") || recipe.seasons.includes("全年")) score += 6;
    if (recipe.scenes.includes(meal)) score += 10;
    if (festivalHints.some(f => recipe.festivals.includes(f) || recipe.scenes.includes(f))) score += 16;

    // 2) 首页吸引力：优先让第一屏出现更有食欲、更像“想点进去”的家常菜。
    const appetiteTerms = ["番茄", "西红柿", "鸡蛋", "虾", "鱼", "牛肉", "鸡", "排骨", "肉", "豆腐", "土豆", "南瓜", "玉米", "彩椒", "胡萝卜", "香菇"];
    const classicTerms = ["红烧", "糖醋", "宫保", "香煎", "煎", "炒", "焖", "烤", "咖喱", "家常"];
    appetiteTerms.forEach(t => { if (text.includes(t)) score += 4; });
    classicTerms.forEach(t => { if (text.includes(t)) score += 5; });
    if (["酸甜", "咸鲜", "鲜香", "香辣", "家常"].some(t => taste.includes(t) || text.includes(t))) score += 8;
    if (["热菜", "主食", "汤羹"].some(t => category.includes(t))) score += 5;

    // 3) 仍保留实用性：不要推荐太难、太久的菜。
    if (recipe.minutes && recipe.minutes <= 15) score += 8;
    else if (recipe.minutes && recipe.minutes <= 30) score += 6;
    else if (recipe.minutes && recipe.minutes > 60) score -= 8;

    // 4) 健康作为加分项，不再压过“好吃/想吃”的首页目标。
    if (["低卡", "超低卡"].includes(recipe.calorieLevel)) score += 2;
    if (recipe.healthTags.some(t => ["高蛋白", "滋补", "养胃", "低脂"].includes(t))) score += 3;

    // 5) 避免首页全是绿色轻食：过于单一的凉拌/纯蔬菜类轻微降权，但不是排除。
    const greenOnlyTerms = ["青菜", "空心菜", "生菜", "黄瓜", "菠菜", "西兰花", "芹菜", "苦瓜"];
    const hasProtein = /鸡蛋|鸡胸|鸡肉|牛肉|猪肉|排骨|鱼|虾|豆腐|腐竹|蛋|肉/.test(text);
    const greenHits = greenOnlyTerms.filter(t => text.includes(t)).length;
    if ((category.includes("凉菜") || method.includes("拌")) && !hasProtein) score -= 7;
    if (greenHits >= 1 && !hasProtein) score -= 5;

    if (mode === "season") score += (recipe.seasons.includes(season) ? 26 : 0);
    if (mode === "fast") {
      score += (recipe.minutes && recipe.minutes <= 15) ? 28 : 0;
      score += hasProtein ? 8 : 0;
      score += recipe.healthTags.some(t => ["低脂", "低卡", "减脂", "高蛋白"].includes(t)) ? 6 : 0;
    }
    return score;
  }

  function topHomeRecipes(mode, limit) {
    const pool = Array.isArray(recipes) ? recipes : [];
    if (!pool.length) return [];
    const sorted = pool
      .map(r => ({ ...r, _homeScore: scoreForHome(r, mode) }))
      .sort((a, b) =>
        (b._homeScore - a._homeScore) ||
        ((a.minutes ?? 9999) - (b.minutes ?? 9999)) ||
        String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans-CN")
      );

    const positive = sorted.filter(r => r._homeScore > 0);
    const source = positive.length >= Math.min(limit, 1) ? positive : sorted;
    return source.slice(0, Math.max(0, limit || 0));
  }

  function renderMiniRecommendations(targetId, items) {
    const box = $("#" + targetId);
    if (!box) return;
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) {
      box.innerHTML = `<div class="empty-state compact">暂无可推荐菜谱，请检查数据文件。</div>`;
      return;
    }
    box.innerHTML = list.map(r => `
      <div class="mini-rec today-dish-mini detail-clickable" data-open-detail="${r.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(r.name)}详情">
        <div class="mini-thumb">${recipeImageHtml(r, "mini-thumb-img", "菜品图片")}</div>
        <div class="mini-info">
          <strong>${escapeHtml(r.name)}</strong>
          <small>${escapeHtml(r.timeLabel)} · ${escapeHtml(r.calorieLevel)}</small>
        </div>
      </div>
    `).join("");
    bindCardButtons(box);
  }


  function recipeImageHtml(recipe, className, label) {
    if (recipe.image) {
      return `<img class="${className}" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" loading="lazy" />`;
    }
    return `<div class="dish-photo-placeholder"><span>${iconFor(recipe)}</span><small>${escapeHtml(label || "菜品图片")}</small></div>`;
  }

  function renderHomeRecommendations() {
    const slides = topHomeRecipes("today", 3);
    const box = $("#heroRecommendation");
    if (box && !slides.length) {
      box.innerHTML = `<div class="empty-state">当前菜谱数据为空，无法生成今日推荐。</div>`;
    }
    if (slides.length && box) {
      homeSlideIndex = ((homeSlideIndex % slides.length) + slides.length) % slides.length;
      const hero = slides[homeSlideIndex];
      box.innerHTML = `
        <div class="carousel-visual detail-clickable" data-open-detail="${hero.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(hero.name)}详情">
          <button class="carousel-nav prev" data-carousel="prev" aria-label="上一道推荐">‹</button>
          ${hero.image ? `<img class="dish-photo hero-dish-photo" src="${escapeHtml(hero.image)}" alt="${escapeHtml(hero.name)}" loading="eager" decoding="async" fetchpriority="high" />` : `<div class="dish-photo-placeholder hero-dish-photo"><span>${iconFor(hero)}</span><small>菜品图片</small></div>`}
          <button class="carousel-nav next" data-carousel="next" aria-label="下一道推荐">›</button>
        </div>
        <div class="featured-body simple-featured detail-clickable" data-open-detail="${hero.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(hero.name)}详情">
          <span class="featured-label">推荐菜品</span>
          <h2>${escapeHtml(hero.name)}</h2>
          <div class="carousel-bottom no-action">
            <div class="carousel-dots">${slides.map((_, i) => `<button class="dot ${i === homeSlideIndex % slides.length ? "active" : ""}" data-carousel-index="${i}" aria-label="切换到第 ${i + 1} 道推荐"></button>`).join("")}</div>
          </div>
        </div>`;
      bindCardButtons(box);
      $$('[data-carousel]', box).forEach(btn => btn.addEventListener('click', () => {
        homeSlideIndex = btn.dataset.carousel === 'prev' ? (homeSlideIndex + slides.length - 1) % slides.length : (homeSlideIndex + 1) % slides.length;
        renderHomeRecommendations();
      }));
      $$('[data-carousel-index]', box).forEach(btn => btn.addEventListener('click', () => {
        homeSlideIndex = Number(btn.dataset.carouselIndex) || 0;
        renderHomeRecommendations();
      }));
    }
    renderMiniRecommendations("todayRecs", topHomeRecipes("today", 5));
  }

  function syncCheckboxes(key) {
    $$(`input[data-state-array="${key}"]`).forEach(input => {
      input.checked = state[key].includes(input.value);
    });
  }

  function applyQuickFilter(kind, value) {
    clearFilters({ silent: true });
    if (kind === "scene") {
      state.scenes = [value];
      syncCheckboxes("scenes");
    }
    if (kind === "health") {
      state.healthTags = [value];
      syncCheckboxes("healthTags");
    }
    if (kind === "season") {
      state.seasons = [getCurrentSeason()];
      syncCheckboxes("seasons");
    }
    switchTab("recipes");
    renderRecipes();
    document.querySelector(".layout")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getFavorites() {
    try { return JSON.parse(storageGet("recipeFavorites") || "[]"); }
    catch { return []; }
  }

  function setFavorites(ids) {
    storageSet("recipeFavorites", JSON.stringify(ids));
    updateStats();
  }

  function updateFavoriteButtonState(id, isFav) {
    $$('[data-fav]').forEach(btn => {
      if (btn.dataset.fav !== id) return;
      btn.classList.toggle('faved', isFav);
      const name = btn.dataset.recipeName || '';
      btn.setAttribute('aria-label', `${isFav ? '取消收藏' : '收藏'}${name}`);
      if (btn.classList.contains('detail-fav-btn')) {
        btn.textContent = isFav ? '♥ 已收藏' : '♡ 收藏';
      } else {
        btn.textContent = isFav ? '♥' : '♡';
      }
    });
  }

  function toggleFavorite(id) {
    const ids = getFavorites();
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    const isFav = next.includes(id);
    setFavorites(next);
    renderRecipes();
    renderFavorites();
    updateFavoriteButtonState(id, isFav);
    toast(isFav ? "已加入收藏" : "已取消收藏");
  }

  function renderRecipeCard(recipe) {
    const tags = [recipe.taste, recipe.method, recipe.difficulty, recipe.calorieLevel, ...recipe.healthTags.slice(0, 3)].filter(Boolean);
    const nutrition = getRecipeNutrition(recipe);
    return `
      <article class="recipe-card detail-clickable" data-open-detail="${recipe.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(recipe.name)}详情">
        <div class="card-visual">${recipe.image ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" loading="lazy" />` : `<div><span>${iconFor(recipe)}</span>${escapeHtml(recipe.category || "菜谱")}</div>`}</div>
        <div class="card-body">
          <h3>${escapeHtml(recipe.name)}</h3>
          <div class="meta-line">${escapeHtml(recipe.timeLabel || "-")} · ${escapeHtml(nutritionText(recipe))} · ${escapeHtml(recipe.difficulty || "-")}</div>
          <div class="tag-row">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
          <div class="ingredient-line">食材：${escapeHtml(recipe.ingredients.slice(0, 5).map(i => i.name).join("、"))}${recipe.ingredients.length > 5 ? "…" : ""}</div>
        </div>
      </article>
    `;
  }

  function getEmptyResultRecommendations(limit = 6) {
    const pool = Array.isArray(recipes) ? recipes.filter(Boolean) : [];
    if (!pool.length) return [];

    const criteriaText = [
      state.keyword,
      ...(state.ingredients || []),
      ...(state.avoidIngredients || []),
      ...(state.healthTags || []),
      ...(state.scenes || []),
      ...(state.seasons || [])
    ].filter(Boolean).join(" ");

    const preferred = pool
      .map(recipe => ({ recipe, score: scoreRecipe(recipe, criteriaText) + scoreForHome(recipe, "today") * 0.15 }))
      .sort((a, b) =>
        (b.score - a.score) ||
        ((a.recipe.minutes ?? 9999) - (b.recipe.minutes ?? 9999)) ||
        String(a.recipe.name || "").localeCompare(String(b.recipe.name || ""), "zh-Hans-CN")
      )
      .map(item => item.recipe);

    const fallback = topHomeRecipes("today", limit);
    return uniqueById([...preferred, ...fallback]).slice(0, Math.max(0, limit || 0));
  }

  function renderEmptySearchRecommendations() {
    const recs = getEmptyResultRecommendations(6);
    const recHtml = recs.length
      ? `<div class="empty-recommend-section">
          <div class="empty-recommend-head">
            <h3>先看看这些推荐菜品</h3>
            <p>当前条件没有精确匹配，可以先参考下面菜品，或减少筛选条件再试。</p>
          </div>
          <div class="empty-recommend-grid">${recs.map(renderRecipeCard).join("")}</div>
        </div>`
      : "";
    return `<div class="empty-result-panel">
      <div class="empty-state">没有匹配的菜谱。可以减少筛选条件，或清空筛选后重新检索。</div>
      ${recHtml}
    </div>`;
  }

  function renderRecipes() {
    const filtered = getFilteredRecipes();
    $("#resultSummary").textContent = `共找到 ${filtered.length} 道菜谱（总数据 ${recipes.length} 条）`;
    $("#recipeGrid").innerHTML = filtered.length
      ? filtered.map(renderRecipeCard).join("")
      : renderEmptySearchRecommendations();
    renderActiveFilters();
    bindCardButtons($("#recipeGrid"));
  }

  function renderFavorites() {
    const favIds = getFavorites();
    const favRecipes = recipes.filter(r => favIds.includes(r.id));
    $("#favoriteGrid").innerHTML = favRecipes.length
      ? favRecipes.map(renderRecipeCard).join("")
      : `<div class="empty-state">暂未收藏菜谱。点击菜谱进入详情页后，可以在详情页收藏。</div>`;
    bindCardButtons($("#favoriteGrid"));
  }

  function isInteractiveClickTarget(target) {
    return Boolean(target.closest("button, a, input, select, textarea, summary, [data-no-detail]"));
  }

  function bindCardButtons(root) {
    $$("[data-detail]", root).forEach(btn => btn.addEventListener("click", event => {
      event.stopPropagation();
      openDetail(btn.dataset.detail);
    }));
    $$("[data-open-detail]", root).forEach(card => {
      card.addEventListener("click", event => {
        if (isInteractiveClickTarget(event.target)) return;
        openDetail(card.dataset.openDetail);
      });
      card.addEventListener("keydown", event => {
        if (!["Enter", " "].includes(event.key) || isInteractiveClickTarget(event.target)) return;
        event.preventDefault();
        openDetail(card.dataset.openDetail);
      });
    });
    $$("[data-fav]", root).forEach(btn => btn.addEventListener("click", event => {
      event.stopPropagation();
      toggleFavorite(btn.dataset.fav);
    }));
  }

  function openDetail(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    window.location.hash = `recipe/${encodeURIComponent(id)}`;
  }

  function commentStars(rating) {
    const n = Number(rating || 0);
    if (!n) return "";
    return `<span class="comment-stars" aria-label="${n}星">${"★".repeat(Math.max(1, Math.min(5, n)))}${"☆".repeat(Math.max(0, 5 - n))}</span>`;
  }

  function renderCommentImages(images = []) {
    const list = Array.isArray(images) ? images.filter(Boolean).slice(0, 6) : [];
    if (!list.length) return "";
    return `<div class="comment-image-grid">${list.map((src, index) => `
      <a href="${escapeHtml(src)}" target="_blank" rel="noopener" class="comment-image-link" aria-label="查看评论图片${index + 1}">
        <img src="${escapeHtml(src)}" alt="评论图片${index + 1}" loading="lazy" />
      </a>
    `).join("")}</div>`;
  }

  function renderCommentList(recipeId, comments) {
    const box = document.getElementById(`commentsList-${recipeId}`) || $("#commentsList");
    if (!box) return;
    if (!comments.length) {
      box.innerHTML = `<div class="comment-empty">还没有评论，来分享第一个做菜心得吧。</div>`;
      return;
    }
    box.innerHTML = comments.map(item => `
      <article class="comment-card">
        <div class="comment-card-head">
          <strong>${escapeHtml(item.nickname || "食友")}</strong>
          <span>${escapeHtml(item.createdAt || "刚刚")}</span>
        </div>
        <div class="comment-rating-line">${commentStars(item.rating)}</div>
        <p>${escapeHtml(item.content || "")}</p>
        ${renderCommentImages(item.images)}
      </article>
    `).join("");
  }

  async function loadRecipeComments(recipeId) {
    const box = document.getElementById(`commentsList-${recipeId}`) || $("#commentsList");
    if (!box) return;
    box.innerHTML = `<div class="comment-empty">正在加载评论...</div>`;
    try {
      const resp = await fetch(`/api/recipe-comments?recipeId=${encodeURIComponent(recipeId)}`, { cache: "no-store" });
      const payload = await resp.json();
      if (!resp.ok || payload.ok === false) throw new Error(payload.message || "评论加载失败");
      renderCommentList(recipeId, Array.isArray(payload.comments) ? payload.comments : []);
    } catch (error) {
      box.innerHTML = `<div class="comment-empty error-state">${escapeHtml(error.message || "评论加载失败，请确认已执行评论表 SQL。")}</div>`;
    }
  }

  async function readCommentImageFiles(files) {
    const selected = Array.from(files || []).filter(Boolean);
    if (selected.length > 6) throw new Error("评论图片最多上传 6 张。");
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const images = [];
    for (let i = 0; i < selected.length; i += 1) {
      const file = selected[i];
      if (!allowed.includes(file.type)) throw new Error(`第 ${i + 1} 张评论图片格式不支持。`);
      if (file.size > 5 * 1024 * 1024) throw new Error(`第 ${i + 1} 张评论图片过大，请控制在 5MB 内。`);
      images.push(await readFileAsDataUrl(file, `第 ${i + 1} 张评论图片`));
    }
    return images;
  }

  function bindCommentForm(recipeId) {
    const form = document.getElementById(`commentForm-${recipeId}`) || $("#commentForm");
    if (!form) return;
    const result = $(".comment-form-result", form.parentElement);
    const imageInput = $("[name='commentImages']", form);
    const imageHint = $(".comment-image-hint", form);
    imageInput?.addEventListener("change", () => {
      const count = imageInput.files?.length || 0;
      if (imageHint) imageHint.textContent = count ? `已选择 ${count} 张图片（最多 6 张）` : "最多 6 张，每张不超过 5MB";
      if (count > 6 && result) result.textContent = "评论图片最多上传 6 张。";
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const btn = $("button[type='submit']", form);
      const nickname = $("[name='nickname']", form)?.value || "";
      const rating = $("[name='rating']", form)?.value || "";
      const content = $("[name='content']", form)?.value || "";
      if (!content.trim()) {
        if (result) result.textContent = "请先写下评论内容。";
        return;
      }
      if (btn) btn.disabled = true;
      if (result) result.textContent = "正在处理图片...";
      try {
        const images = await readCommentImageFiles(imageInput?.files || []);
        if (result) result.textContent = "正在发布...";
        const resp = await fetch("/api/recipe-comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId, nickname, rating: rating ? Number(rating) : null, content, images })
        });
        const payload = await resp.json();
        if (!resp.ok || payload.ok === false) throw new Error(payload.message || "评论发布失败");
        form.reset();
        if (imageHint) imageHint.textContent = "最多 6 张，每张不超过 5MB";
        if (result) result.textContent = "评论已发布。";
        await loadRecipeComments(recipeId);
      } catch (error) {
        if (result) result.textContent = error.message || "评论发布失败，请确认已执行评论图片表 SQL。";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  function renderDetailPage(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) {
      document.body.classList.remove("detail-mode");
      $("#detailPage").hidden = true;
      $(".layout").hidden = false;
      $(".hero").hidden = false;
      $(".help") && ($(".help").hidden = false);
      return;
    }

    const fav = getFavorites().includes(recipe.id);
    const nutrition = getRecipeNutrition(recipe);
    const macroLine = `蛋白质约${nutrition.protein}g · 脂肪约${nutrition.fat}g · 碳水约${nutrition.carb}g`;
    const stepImages = recipe.stepImages || (recipe.images || []).filter(src => src !== recipe.image);
    const coverGallery = recipe.images && recipe.images.length
      ? recipe.images
      : [recipe.image].filter(Boolean);
    const related = recipes
      .filter(r => r.id !== recipe.id && (r.category === recipe.category || r.method === recipe.method || r.taste === recipe.taste || r.healthTags.some(t => recipe.healthTags.includes(t))))
      .slice(0, 4);

    $("#detailContent").innerHTML = `
      <article class="recipe-detail-page">
        <button class="back-btn" id="detailBackBtn">← 退出详情，返回首页</button>
        <section class="detail-hero">
          <div class="detail-hero-photo">
            ${recipe.image ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.name)}" />` : `<div class="detail-no-photo">${iconFor(recipe)}</div>`}
          </div>
          <div class="detail-hero-info">
            <p class="eyebrow">RECIPE DETAIL</p>
            <div class="detail-title-line">
              <h1>${escapeHtml(recipe.name)}</h1>
              <button class="detail-fav-btn ${fav ? "faved" : ""}" data-fav="${recipe.id}" data-recipe-name="${escapeHtml(recipe.name)}" aria-label="${fav ? "取消收藏" : "收藏"}${escapeHtml(recipe.name)}">${fav ? "♥ 已收藏" : "♡ 收藏"}</button>
            </div>
            <p class="detail-summary">${escapeHtml(recipe.category)} · ${escapeHtml(recipe.taste)} · ${escapeHtml(recipe.method)} · ${escapeHtml(recipe.timeLabel)} · ${escapeHtml(nutritionText(recipe))}</p>
            <div class="tag-row detail-tags">
              ${[recipe.difficulty, recipe.calorieLevel, ...recipe.healthTags, ...recipe.seasons, ...recipe.scenes, ...recipe.festivals].filter(Boolean).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
            </div>
            <div class="detail-stat-row">
              <div><strong>${escapeHtml(recipe.timeLabel || "-")}</strong><span>制作时长</span></div>
              <div><strong>${escapeHtml(nutrition.perServingCalories)} 千卡</strong><span>估算每份</span></div>
              <div><strong>${escapeHtml(nutrition.totalCalories)} 千卡</strong><span>整菜热量</span></div>
            </div>
            <div class="nutrition-note">
              <strong>营养估算</strong>
              <span>${escapeHtml(macroLine)}</span>
              <small>按用料克数/常见单位换算，约 ${escapeHtml(nutrition.servings)} 人份；原始参考：${escapeHtml(recipe.caloriesText || "未注明")}</small>
            </div>
            <p class="meta-line">来源：${escapeHtml(recipe.source || "未注明")}</p>
          </div>
        </section>

        <section class="detail-main-grid">
          <aside class="ingredient-panel">
            <h2>用料</h2>
            <ul class="ingredient-list">
              ${recipe.ingredients.map(i => { const grams = estimateIngredientGrams(i); return `<li><span>${escapeHtml(i.name)}</span><em>${escapeHtml([i.role, i.amount, grams ? `估${Math.round(grams)}g` : ""].filter(Boolean).join(" · "))}</em></li>`; }).join("")}
            </ul>
          </aside>

          <section class="steps-panel">
            <h2>做法步骤</h2>
            <ol class="detail-step-list">
              ${recipe.steps.map((step, i) => `
                <li>
                  <div class="step-index">${i + 1}</div>
                  <div class="step-body">
                    <p>${escapeHtml(step)}</p>
                    ${stepImages[i] ? `<img src="${escapeHtml(stepImages[i])}" alt="${escapeHtml(recipe.name)}步骤${i + 1}" loading="lazy" />` : ""}
                  </div>
                </li>
              `).join("")}
            </ol>
          </section>
        </section>

        <section class="comments-section">
          <div class="comments-head">
            <div>
              <h2>社区讨论</h2>
              <p>可以记录试做反馈、口味调整和小技巧。</p>
            </div>
          </div>
          <form class="comment-form" id="commentForm-${recipe.id}">
            <div class="comment-form-row">
              <input name="nickname" maxlength="40" placeholder="昵称，可不填" />
              <select name="rating" aria-label="评分">
                <option value="">不评分</option>
                <option value="5">5星 很推荐</option>
                <option value="4">4星 不错</option>
                <option value="3">3星 还可以</option>
                <option value="2">2星 一般</option>
                <option value="1">1星 待改进</option>
              </select>
            </div>
            <textarea name="content" maxlength="800" rows="4" placeholder="写下你对这道菜的评价、改动建议或制作心得"></textarea>
            <label class="comment-image-picker">
              <span>上传评论照片</span>
              <input name="commentImages" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple />
              <em class="comment-image-hint">最多 6 张，每张不超过 5MB</em>
            </label>
            <div class="comment-form-actions">
              <span class="comment-form-result"></span>
              <button type="submit">发布评论</button>
            </div>
          </form>
          <div class="comments-list" id="commentsList-${recipe.id}">
            <div class="comment-empty">正在加载评论...</div>
          </div>
        </section>

        ${related.length ? `
          <section class="related-section">
            <h2>相似菜谱</h2>
            <div class="related-grid">
              ${related.map(renderRecipeCard).join("")}
            </div>
          </section>
        ` : ""}
      </article>
    `;
    document.body.classList.add("detail-mode");
    $("#detailPage").hidden = false;
    $(".layout").hidden = true;
    $(".hero").hidden = true;
    $(".help") && ($(".help").hidden = true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#detailBackBtn")?.addEventListener("click", () => {
      history.pushState("", document.title, window.location.pathname + window.location.search);
      renderRoute();
    });
    bindCardButtons($("#detailContent"));
    bindCommentForm(recipe.id);
    loadRecipeComments(recipe.id);
  }

  function renderRoute() {
    const match = window.location.hash.match(/^#recipe\/([^/]+)$/);
    if (match) {
      renderDetailPage(decodeURIComponent(match[1]));
      return;
    }
    document.body.classList.remove("detail-mode");
    $("#detailPage").hidden = true;
    $(".layout").hidden = false;
    $(".hero").hidden = false;
    $(".help") && ($(".help").hidden = false);
    syncPageChrome(state.currentTab);
  }

  function closeModal() {
    const modal = $("#modalBackdrop");
    if (modal) modal.hidden = true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[s]));
  }

  function renderOptions() {
    fillDatalist("ingredientList", safeList(meta.ingredients));
    fillDatalist("seasoningList", Array.from(new Set([...safeList(meta.seasonings), "辣椒", "大蒜", "花椒", "小米辣", "糖", "盐"])));
    fillSelectOptions("ugcCategory", safeList(meta.categories), "请选择分类");
    fillSelectOptions("ugcTaste", safeList(meta.tastes), "请选择口味");
    fillSelectOptions("ugcMethod", safeList(meta.methods), "请选择做法");
    fillSelectOptions("ugcDifficulty", safeList(meta.difficulties), "请选择难度");
    fillSelectOptions("ugcCalorieLevel", safeList(meta.calorieLevels), "请选择热量等级");

    renderCheckboxes("tasteOptions", safeList(meta.tastes), "tastes");
    renderCheckboxes("methodOptions", safeList(meta.methods), "methods");
    renderCheckboxes("difficultyOptions", safeList(meta.difficulties), "difficulties");
    renderCheckboxes("calorieLevelOptions", safeList(meta.calorieLevels), "calorieLevels");
    renderCheckboxes("healthTagOptions", safeList(meta.healthTags), "healthTags");
    renderCheckboxes("sceneOptions", safeList(meta.scenes), "scenes");
    renderCheckboxes("seasonOptions", safeList(meta.seasons), "seasons");
    renderCheckboxes("festivalOptions", safeList(meta.festivals), "festivals");

    const allergenHtml = Object.keys(allergenGroups).map(name => (
      `<label><input type="checkbox" data-state-array="allergens" value="${escapeHtml(name)}" /> ${escapeHtml(name)}</label>`
    )).join("");
    $("#allergenOptions").innerHTML = allergenHtml;
    $$("[data-state-array]").forEach(input => {
      input.addEventListener("change", () => {
        const key = input.dataset.stateArray;
        updateArrayFromCheckboxes(key);
        renderRecipes();
      });
    });
  }

  function renderCheckboxes(containerId, options, stateKey) {
    options = Array.isArray(options) ? options : [];
    const html = options.map(opt => `<label><input type="checkbox" data-state-array="${stateKey}" value="${escapeHtml(opt)}" /> ${escapeHtml(opt)}</label>`).join("");
    $("#" + containerId).innerHTML = html;
  }

  function fillDatalist(id, options) {
    options = Array.isArray(options) ? options : [];
    const el = $("#" + id);
    if (!el) return;
    el.innerHTML = options.map(opt => `<option value="${escapeHtml(opt)}"></option>`).join("");
  }

  function fillSelectOptions(id, options, placeholder = "请选择") {
    const el = $("#" + id);
    if (!el) return;
    const current = el.value;
    const unique = Array.from(new Set((Array.isArray(options) ? options : []).filter(Boolean)));
    el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + unique.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("");
    if (current && unique.includes(current)) el.value = current;
  }

  function updateArrayFromCheckboxes(key) {
    state[key] = $$(`input[data-state-array="${key}"]:checked`).map(i => i.value);
  }

  function addChipValue(key, value, renderTarget) {
    const clean = String(value || "").trim();
    if (!clean) return;
    if (!state[key].includes(clean)) state[key].push(clean);
    renderChipList(key, renderTarget);
    renderRecipes();
  }

  function removeChipValue(key, value, renderTarget) {
    state[key] = state[key].filter(x => x !== value);
    renderChipList(key, renderTarget);
    renderRecipes();
  }

  function renderChipList(key, target) {
    const box = $("#" + target);
    if (!state[key].length) {
      box.className = "chip-row empty";
      box.textContent = key === "ingredients" ? "尚未选择食材" : "尚未设置忌口";
      return;
    }
    box.className = "chip-row";
    box.innerHTML = state[key].map(v => `<span class="chip">${escapeHtml(v)} <button data-remove-chip="${escapeHtml(v)}">×</button></span>`).join("");
    $$("[data-remove-chip]", box).forEach(btn => {
      btn.addEventListener("click", () => removeChipValue(key, btn.dataset.removeChip, target));
    });
  }

  function bindFilters() {
    $("#searchBtn").addEventListener("click", () => {
      state.keyword = $("#keywordInput").value.trim();
      renderRecipes();
    });
    $("#keywordInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        state.keyword = e.target.value.trim();
        renderRecipes();
      }
    });
    $("#keywordInput").addEventListener("input", debounce(e => {
      state.keyword = e.target.value.trim();
      renderRecipes();
    }, 180));

    $("#sortSelect").addEventListener("change", e => {
      state.sort = e.target.value;
      renderRecipes();
    });

    $("#addIngredientBtn").addEventListener("click", () => {
      addChipValue("ingredients", $("#ingredientInput").value, "selectedIngredients");
      $("#ingredientInput").value = "";
    });
    $("#ingredientInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("#addIngredientBtn").click();
      }
    });

    $("#addSeasoningBtn").addEventListener("click", () => {
      addChipValue("excludedSeasonings", $("#seasoningInput").value, "excludedSeasonings");
      $("#seasoningInput").value = "";
    });
    $("#seasoningInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("#addSeasoningBtn").click();
      }
    });

    ["minCalories", "maxCalories", "maxMinutes"].forEach(id => {
      $("#" + id).addEventListener("input", debounce(e => {
        state[id] = parseNum(e.target.value);
        renderRecipes();
      }, 180));
    });

    $$("[data-calorie-max]").forEach(btn => btn.addEventListener("click", () => {
      state.maxCalories = Number(btn.dataset.calorieMax);
      $("#maxCalories").value = state.maxCalories;
      renderRecipes();
    }));
    $$("[data-time-max]").forEach(btn => btn.addEventListener("click", () => {
      state.maxMinutes = Number(btn.dataset.timeMax);
      $("#maxMinutes").value = state.maxMinutes;
      renderRecipes();
    }));

    $$("[data-condition]").forEach(input => {
      input.addEventListener("change", () => {
        state.conditions = $$("[data-condition]:checked").map(i => i.dataset.condition);
        renderRecipes();
      });
    });

    $("#currentSeasonBtn")?.addEventListener("click", () => {
      const season = getCurrentSeason();
      state.seasons = [season];
      $$(`input[data-state-array="seasons"]`).forEach(i => i.checked = i.value === season);
      renderRecipes();
      toast(`已切换为${season}季时令菜谱`);
    });

    $("#clearFiltersBtn").addEventListener("click", () => clearFilters());
    $("#exportBtn").addEventListener("click", exportCurrentResults);
    $("#aiJumpBtn")?.addEventListener("click", () => {
      switchTab("ai");
      document.querySelector(".content")?.scrollIntoView({ behavior: "smooth", block: "start" });
      $("#aiQuestion")?.focus();
    });
    $("#seasonCardBtn")?.addEventListener("click", () => applyQuickFilter("season", getCurrentSeason()));
    $$('[data-quick-scene]').forEach(btn => btn.addEventListener("click", () => applyQuickFilter("scene", btn.dataset.quickScene)));
    $$('[data-quick-health]').forEach(btn => btn.addEventListener("click", () => applyQuickFilter("health", btn.dataset.quickHealth)));

    $$("[data-collapse]").forEach(btn => {
      btn.addEventListener("click", () => {
        const panel = $("#" + btn.dataset.collapse);
        panel.hidden = !panel.hidden;
        btn.querySelector("span").textContent = panel.hidden ? "+" : "−";
      });
      const panel = $("#" + btn.dataset.collapse);
      panel.hidden = false;
      btn.querySelector("span").textContent = "−";
    });

    $("#modalClose").addEventListener("click", closeModal);
    $("#modalBackdrop").addEventListener("click", e => {
      if (e.target.id === "modalBackdrop") closeModal();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });

    $("#themeToggle").addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      storageSet("recipeTheme", document.documentElement.classList.contains("dark") ? "dark" : "light");
      $("#themeToggle").textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
    });
  }

  function clearFilters(options = {}) {
    Object.assign(state, {
      keyword: "",
      ingredients: [],
      tastes: [],
      methods: [],
      difficulties: [],
      calorieLevels: [],
      healthTags: [],
      conditions: [],
      allergens: [],
      excludedSeasonings: [],
      scenes: [],
      seasons: [],
      festivals: [],
      minCalories: null,
      maxCalories: null,
      maxMinutes: null,
      sort: "score"
    });
    $("#keywordInput").value = "";
    $("#minCalories").value = "";
    $("#maxCalories").value = "";
    $("#maxMinutes").value = "";
    $("#sortSelect").value = "score";
    $$("input[type='checkbox']").forEach(i => i.checked = false);
    renderChipList("ingredients", "selectedIngredients");
    renderChipList("excludedSeasonings", "excludedSeasonings");
    renderRecipes();
    if (!options.silent) toast("已清空筛选条件");
  }

  function renderActiveFilters() {
    const filters = [];
    if (state.keyword) filters.push(`关键字：${state.keyword}`);
    if (state.ingredients.length) filters.push(`食材：${state.ingredients.join("、")}`);
    if (state.tastes.length) filters.push(`口味：${state.tastes.join("、")}`);
    if (state.methods.length) filters.push(`做法：${state.methods.join("、")}`);
    if (state.conditions.length) filters.push(`三高：${state.conditions.join("、")}`);
    if (state.allergens.length) filters.push(`过敏排除：${state.allergens.join("、")}`);
    if (state.excludedSeasonings.length) filters.push(`忌口：${state.excludedSeasonings.join("、")}`);
    if (state.maxMinutes !== null) filters.push(`时长≤${state.maxMinutes}分钟`);
    if (state.maxCalories !== null) filters.push(`热量≤${state.maxCalories}`);
    if (state.minCalories !== null) filters.push(`热量≥${state.minCalories}`);
    ["difficulties", "calorieLevels", "healthTags", "scenes", "seasons", "festivals"].forEach(key => {
      if (state[key].length) filters.push(state[key].join("、"));
    });
    $("#activeCount").textContent = `${filters.length} 项`;
    $("#activeFilters").innerHTML = filters.map(f => `<span class="chip">${escapeHtml(f)}</span>`).join("");
  }

  function exportCurrentResults() {
    const filtered = getFilteredRecipes();
    const rows = [
      ["菜谱编号", "菜名", "类型", "口味", "做法", "时长", "难度", "每份热量估算", "整菜热量估算", "蛋白质估算", "脂肪估算", "碳水估算", "健康标签", "食材"]
    ];
    filtered.forEach(r => {
      const n = getRecipeNutrition(r);
      rows.push([
        r.id, r.name, r.category, r.taste, r.method, r.timeLabel, r.difficulty,
        `${n.perServingCalories}千卡`, `${n.totalCalories}千卡`, `${n.protein}g`, `${n.fat}g`, `${n.carb}g`,
        r.healthTags.join("、"), r.ingredients.map(i => `${i.name}(${i.amount})`).join("、")
      ]);
    });
    const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `菜谱检索结果_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function syncPageChrome(tabName) {
    const isHome = tabName === "recipes";
    const heroGrid = $(".hero-grid");
    const homeRecs = $(".home-recs.today-only-recs");
    const homeSearch = $(".today-only-search");
    const filters = $(".filters");

    // V35：用 hidden 属性 + body 状态类双保险，避免其他页面继续露出首页推荐/首页检索区。
    if (heroGrid) heroGrid.hidden = !isHome;
    if (homeRecs) homeRecs.hidden = !isHome;
    if (homeSearch) homeSearch.hidden = !isHome;
    if (filters) filters.hidden = !isHome;

    document.body.classList.toggle("home-active", isHome);
    document.body.classList.toggle("core-tab-active", !isHome);
    $(".layout")?.classList.toggle("core-only", !isHome);
    $(".hero")?.classList.toggle("nav-only", !isHome);
  }

  function switchTab(tabName) {
    if (window.location.hash.startsWith("#recipe/")) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
      renderRoute();
    }
    const tab = $(`.tab[data-tab="${tabName}"]`);
    const panel = $(`#${tabName}Tab`);
    if (!tab || !panel) return;
    $$(".tab").forEach(t => t.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    panel.classList.add("active");
    state.currentTab = tabName;
    syncPageChrome(tabName);
    if (tabName === "favorites") renderFavorites();
  }

  function bindTabs() {
    $$(".tab").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
  }

  function scoreForAi(recipe, signals, query) {
    let score = scoreRecipe(recipe, query);
    signals.ingredients.forEach(ing => { if (includesIngredient(recipe, ing)) score += 34; });
    signals.health.forEach(tag => { if (recipe.healthTags.includes(tag)) score += 24; });
    signals.scenes.forEach(scene => { if (recipe.scenes.includes(scene)) score += 18; });
    signals.seasons.forEach(season => { if (recipe.seasons.includes(season) || recipe.seasons.includes("四季通用") || recipe.seasons.includes("全年")) score += 12; });
    signals.methods.forEach(method => { if (recipe.method === method || recipe.name.includes(method)) score += 12; });
    signals.tastes.forEach(taste => { if (recipe.taste === taste) score += 12; });
    if (signals.maxMinutes && recipe.minutes) {
      if (recipe.minutes <= signals.maxMinutes) score += 22;
      else if (!signals.hardMaxMinutes && recipe.minutes <= signals.maxMinutes + 10) score += 8;
    }
    const nutrition = getRecipeNutrition(recipe);
    if (signals.maxCalories && nutrition.perServingCalories <= signals.maxCalories) score += 18;
    if (/减脂|低卡|低脂|控卡/.test(query) && nutrition.perServingCalories && nutrition.perServingCalories <= 220) score += 10;
    return score;
  }

  function localAiCandidates(query, limit = 6) {
    const signals = extractQuerySignals(query);
    let candidates = recipes
      .map(r => ({ ...r, _aiScore: scoreForAi(r, signals, query) }))
      .filter(r => r._aiScore > 0);
    if (!candidates.length) candidates = topHomeRecipes("today", limit).map(r => ({ ...r, _aiScore: r._homeScore || 1 }));
    candidates.sort((a, b) => (b._aiScore - a._aiScore) || (a.calories ?? 9999) - (b.calories ?? 9999));
    return { signals, top: candidates.slice(0, limit) };
  }

  function signalsToText(signals) {
    return [
      signals.ingredients.length ? `食材：${signals.ingredients.join("、")}` : "",
      signals.health.length ? `健康：${signals.health.join("、")}` : "",
      signals.scenes.length ? `场景：${signals.scenes.join("、")}` : "",
      signals.methods.length ? `做法：${signals.methods.join("、")}` : "",
      signals.tastes.length ? `口味：${signals.tastes.join("、")}` : "",
      signals.maxMinutes ? `时间：${signals.maxMinutes}分钟内` : "",
      signals.maxCalories ? `热量：每份≤${signals.maxCalories}千卡` : ""
    ].filter(Boolean).join("；") || "未识别到明确标签，采用综合推荐";
  }

  function recipeContextForAi(recipe) {
    const nutrition = getRecipeNutrition(recipe);
    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      taste: recipe.taste,
      method: recipe.method,
      timeLabel: recipe.timeLabel,
      minutes: recipe.minutes,
      difficulty: recipe.difficulty,
      calorieLevel: recipe.calorieLevel,
      healthTags: safeList(recipe.healthTags),
      scenes: safeList(recipe.scenes),
      seasons: safeList(recipe.seasons),
      ingredients: safeList(recipe.ingredients).slice(0, 10).map(i => ({ name: i.name, amount: i.amount, role: i.role })),
      nutrition: {
        perServingCalories: nutrition.perServingCalories,
        totalCalories: nutrition.totalCalories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carb: nutrition.carb,
        servings: nutrition.servings,
        confidence: nutrition.confidence
      },
      steps: safeList(recipe.steps).slice(0, 3)
    };
  }

  function renderAiLoading(resultBox) {
    resultBox.className = "ai-result";
    resultBox.innerHTML = `
      <div class="ai-answer ai-answer-loading">
        <h3>正在调用 GLM 分析需求...</h3>
        <p>系统正在让模型先分析你的需求，再结合本地菜谱生成回答和相关菜品。</p>
      </div>`;
  }

  function renderLocalAiAnswer(resultBox, query, signals, top, note = "当前使用本地规则推荐。") {
    const first = top[0];
    if (!first) {
      resultBox.className = "ai-result empty-state";
      resultBox.textContent = "暂时没有找到合适菜谱，可以换一种说法或减少限制条件。";
      return;
    }
    const signalsText = signalsToText(signals);
    resultBox.className = "ai-result";
    resultBox.innerHTML = `
      <div class="ai-answer">
        <div class="ai-source-pill local">本地规则</div>
        <h3>推荐优先考虑：${escapeHtml(first.name)}</h3>
        <p>系统先从本地菜谱库识别出需求：${escapeHtml(signalsText)}，再按食材匹配、健康标签、场景、时长和热量参考值排序。${escapeHtml(first.name)}与当前需求匹配度较高，适合优先尝试。</p>
        <div class="ai-picks ai-picks-visual">
          ${top.slice(0, 4).map(r => `<div class="ai-pick ai-pick-visual detail-clickable" data-open-detail="${r.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(r.name)}详情"><div class="ai-pick-thumb">${recipeImageHtml(r, "ai-pick-img", "菜品图片")}</div><div class="ai-pick-copy"><strong>${escapeHtml(r.name)}</strong><div class="meta-line">${escapeHtml(r.taste)} · ${escapeHtml(r.method)} · ${escapeHtml(r.timeLabel)} · ${escapeHtml(nutritionText(r))}</div></div></div>`).join("")}
        </div>
        <p class="package-note">${escapeHtml(note)} 推荐范围限制在本地菜谱库，不生成库外菜谱。</p>
      </div>`;
    bindCardButtons(resultBox);
  }

  function normalizeAiAnswerIds(answer, top) {
    const allowed = new Map(top.map(r => [r.id, r]));
    const ids = Array.isArray(answer?.related_recipe_ids)
      ? answer.related_recipe_ids
      : (Array.isArray(answer?.pick_ids) ? answer.pick_ids : []);
    const selected = ids.map(id => allowed.get(String(id))).filter(Boolean);
    return selected.length ? selected : top.slice(0, 4);
  }

  function aiSearchLanguageTags(answer) {
    const lang = answer?.search_language || {};
    const tags = [];
    ["ingredients", "taste", "method", "scene", "health_goal", "avoid"].forEach(key => {
      const value = lang[key];
      if (Array.isArray(value)) tags.push(...value.filter(Boolean));
      else if (value) tags.push(String(value));
    });
    if (lang.time_limit) tags.push(lang.time_limit);
    if (Array.isArray(answer?.matched_needs)) tags.push(...answer.matched_needs.filter(Boolean));
    return [...new Set(tags)].slice(0, 8);
  }

  function renderModelAiAnswer(resultBox, answer, top, modelName) {
    const picked = normalizeAiAnswerIds(answer, top);
    const title = answer?.ai_title || answer?.summary_title || (picked[0] ? `推荐优先考虑：${picked[0].name}` : "AI 推荐结果");
    const body = answer?.ai_text || answer?.answer || "模型已根据你的需求分析，并结合本地菜谱候选结果生成推荐。";
    const tags = aiSearchLanguageTags(answer);
    const tips = Array.isArray(answer?.tips) ? answer.tips.slice(0, 3) : [];
    const reasons = answer?.recipe_reasons && typeof answer.recipe_reasons === "object" ? answer.recipe_reasons : {};
    resultBox.className = "ai-result";
    resultBox.innerHTML = `
      <div class="ai-answer">
        <div class="ai-source-pill">GLM 模型生成${modelName ? ` · ${escapeHtml(modelName)}` : ""}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        ${tags.length ? `<div class="tag-row ai-needs">${tags.map(n => `<span>${escapeHtml(n)}</span>`).join("")}</div>` : ""}
        <h4 class="ai-related-title">AI 提到的相关菜品</h4>
        <div class="ai-picks ai-picks-visual">
          ${picked.map(r => {
            const reason = reasons[r.id] || `${r.taste} · ${r.method} · ${r.timeLabel} · ${nutritionText(r)}`;
            return `<div class="ai-pick ai-pick-visual detail-clickable" data-open-detail="${r.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(r.name)}详情">
              <div class="ai-pick-thumb">${recipeImageHtml(r, "ai-pick-img", "菜品图片")}</div>
              <div class="ai-pick-copy"><strong>${escapeHtml(r.name)}</strong><div class="meta-line">${escapeHtml(reason)}</div></div>
            </div>`;
          }).join("")}
        </div>
        ${tips.length ? `<ul class="ai-tips">${tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
        <p class="package-note">说明：AI 先分析需求，再结合本地菜谱候选结果推荐；相关菜品可直接点击进入详情页，营养值为估算参考。</p>
      </div>`;
    bindCardButtons(resultBox);
  }

  async function askGlmModel(query, signals, top) {
    const response = await fetch("api/ai-ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: query,
        signals: {
          ingredients: signals.ingredients,
          health: signals.health,
          scenes: signals.scenes,
          tastes: signals.tastes,
          methods: signals.methods,
          seasons: signals.seasons,
          maxMinutes: signals.maxMinutes,
          maxCalories: signals.maxCalories
        },
        candidates: top.map(recipeContextForAi)
      })
    });
    let data = null;
    try { data = await response.json(); }
    catch { data = { ok: false, message: "模型接口返回格式异常。" }; }
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || `模型接口请求失败（HTTP ${response.status}）`);
    }
    return data;
  }

  async function generateAiAnswer() {
    const input = $("#aiQuestion");
    const resultBox = $("#aiResult");
    if (!input || !resultBox) return;
    const query = input.value.trim();
    if (!query) {
      resultBox.className = "ai-result empty-state";
      resultBox.textContent = "先输入你的饮食需求，例如：我想减脂，家里有鸡胸肉和黄瓜。";
      return;
    }
    const { signals, top } = localAiCandidates(query, 6);
    if (window.location.protocol === "file:") {
      renderLocalAiAnswer(resultBox, query, signals, top, "当前是直接打开 index.html，真实模型接口需要通过 python server.py 启动后访问。已自动降级为本地推荐。");
      return;
    }
    renderAiLoading(resultBox);
    try {
      const data = await askGlmModel(query, signals, top);
      renderModelAiAnswer(resultBox, data.answer, top, data.model);
    } catch (error) {
      renderLocalAiAnswer(resultBox, query, signals, top, `${error.message || "模型接口不可用"} 已自动降级为本地推荐。`);
    }
  }

  function bindAiTool() {
    $("#aiAskBtn")?.addEventListener("click", generateAiAnswer);
    $("#aiQuestion")?.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generateAiAnswer();
    });
    $$("[data-ai-sample]").forEach(btn => {
      btn.addEventListener("click", () => {
        $("#aiQuestion").value = btn.dataset.aiSample;
        generateAiAnswer();
      });
    });
  }



  function uploadInputValue(id) {
    return $("#" + id)?.value.trim() || "";
  }

  function parseUploadList(value) {
    return String(value || "")
      .split(/[、,，/\n]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .filter((x, index, arr) => arr.indexOf(x) === index)
      .slice(0, 20);
  }

  function parseUploadIngredients(value) {
    return String(value || "")
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 80)
      .map(line => {
        const parts = line.split(/\s*[|,，]\s*/).map(x => x.trim()).filter(Boolean);
        return {
          name: parts[0] || "",
          amount: parts[1] || "",
          role: parts[2] || "主料",
          type: parts[2] && parts[2].includes("调味") ? "调味料" : "用户食材"
        };
      })
      .filter(item => item.name);
  }

  function parseUploadSteps() {
    return $$(".step-upload-item").map(item => ({
      text: $("textarea", item)?.value?.trim() || "",
      imageFile: $("input[type='file']", item)?.files?.[0] || null
    })).filter(item => item.text || item.imageFile).slice(0, 60);
  }

  function readFileAsDataUrl(file, label = "图片") {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`${label}读取失败`));
      reader.readAsDataURL(file);
    });
  }

  function renderUploadStepItem(text = "") {
    const list = $("#ugcStepList");
    if (!list) return;
    const index = list.children.length + 1;
    const item = document.createElement("div");
    item.className = "step-upload-item";
    item.innerHTML = `
      <div class="step-upload-index">${index}</div>
      <div class="step-upload-main">
        <textarea rows="3" maxlength="800" placeholder="请输入第 ${index} 步，例如：番茄切块，鸡蛋打散。">${escapeHtml(text)}</textarea>
        <label class="step-image-picker">
          <span>步骤图</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          <em>建议上传对应这一步的照片</em>
        </label>
      </div>
      <button type="button" class="step-remove-btn" aria-label="删除步骤">×</button>
    `;
    list.appendChild(item);
    refreshUploadStepNumbers();
  }

  function refreshUploadStepNumbers() {
    $$(".step-upload-item").forEach((item, index) => {
      const n = index + 1;
      $(".step-upload-index", item).textContent = n;
      const textarea = $("textarea", item);
      if (textarea) textarea.placeholder = `请输入第 ${n} 步，例如：番茄切块，鸡蛋打散。`;
      const remove = $(".step-remove-btn", item);
      if (remove) remove.hidden = $$(".step-upload-item").length <= 1;
    });
  }

  function resetUploadSteps() {
    const list = $("#ugcStepList");
    if (!list) return;
    list.innerHTML = "";
    renderUploadStepItem();
  }

  async function normalizeStepPayload(stepItems) {
    const result = [];
    for (let i = 0; i < stepItems.length; i += 1) {
      const item = stepItems[i];
      if (item.imageFile && item.imageFile.size > 5 * 1024 * 1024) {
        throw new Error(`第 ${i + 1} 步图片过大，请控制在 5MB 内。`);
      }
      result.push({
        text: item.text,
        imageData: await readFileAsDataUrl(item.imageFile, `第 ${i + 1} 步图片`)
      });
    }
    return result;
  }

  function setUploadResult(message, type = "info") {
    const box = $("#ugcUploadResult");
    if (!box) return;
    box.className = type === "error" ? "upload-result error-state" : (type === "success" ? "upload-result success-state" : "upload-result empty-state");
    box.innerHTML = message;
  }

  function buildUgcPayload(coverImageData, steps) {
    const minutes = parseNum(uploadInputValue("ugcMinutes"));
    const caloriesValue = parseNum(uploadInputValue("ugcCalories"));
    return {
      recipeName: uploadInputValue("ugcName"),
      author: uploadInputValue("ugcAuthor"),
      category: uploadInputValue("ugcCategory"),
      taste: uploadInputValue("ugcTaste"),
      method: uploadInputValue("ugcMethod"),
      difficulty: uploadInputValue("ugcDifficulty"),
      minutes,
      caloriesValue,
      calorieLevel: uploadInputValue("ugcCalorieLevel"),
      healthTags: parseUploadList(uploadInputValue("ugcHealthTags")),
      scenes: parseUploadList(uploadInputValue("ugcScenes")),
      seasons: parseUploadList(uploadInputValue("ugcSeasons")),
      festivals: parseUploadList(uploadInputValue("ugcFestivals")),
      ingredients: parseUploadIngredients(uploadInputValue("ugcIngredients")),
      steps,
      coverImageData
    };
  }

  async function refreshAfterUgcCreated(createdRecipe) {
    try {
      await loadDatabaseData();
    } catch {
      // loadDatabaseData 内部已经记录错误；这里保留刚提交成功的菜谱，避免用户看不到结果。
    }
    if (createdRecipe && !recipes.some(r => r.id === createdRecipe.id)) {
      recipes.unshift(createdRecipe);
      meta.total = recipes.length;
    }
    nutritionCache.clear();
    updateStats();
    renderOptions();
    renderChipList("ingredients", "selectedIngredients");
    renderChipList("excludedSeasonings", "excludedSeasonings");
    renderHomeRecommendations();
    renderRecipes();
    renderFavorites();
    generatePackage();
  }

  async function submitUgcRecipe(event) {
    event.preventDefault();
    const form = $("#ugcRecipeForm");
    const btn = $("#ugcSubmitBtn");
    if (!form || !btn) return;
    const coverFile = $("#ugcCover")?.files?.[0] || null;
    if (coverFile && coverFile.size > 5 * 1024 * 1024) {
      setUploadResult("封面图过大，请控制在 5MB 内。", "error");
      return;
    }
    setUploadResult("正在提交菜谱，请稍候...", "info");
    btn.disabled = true;
    try {
      const stepItems = parseUploadSteps();
      const steps = await normalizeStepPayload(stepItems);
      const coverImageData = await readFileAsDataUrl(coverFile, "封面图");
      const payload = buildUgcPayload(coverImageData, steps);
      if (!payload.recipeName) throw new Error("请填写菜名。");
      if (!payload.ingredients.length) throw new Error("请至少填写 1 个食材。");
      if (!payload.steps.length || !payload.steps.some(step => step.text)) throw new Error("请至少填写 1 个步骤。");
      const response = await fetch("/api/user-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let data = null;
      try { data = await response.json(); }
      catch { data = { ok: false, message: "上传接口返回格式异常" }; }
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `上传失败（HTTP ${response.status}）`);
      }
      await refreshAfterUgcCreated(data.recipe);
      setUploadResult(`上传成功：${escapeHtml(data.recipe?.name || payload.recipeName)}。已保存到菜谱库，可在检索、详情页和 AI 候选中使用。`, "success");
      toast("菜谱上传成功");
      form.reset();
      resetUploadSteps();
      if (data.recipe?.id) {
        switchTab("recipes");
        openDetail(data.recipe.id);
      }
    } catch (error) {
      setUploadResult(escapeHtml(error.message || "上传失败，请检查后重试。"), "error");
    } finally {
      btn.disabled = false;
    }
  }

  function bindUploadTool() {
    resetUploadSteps();
    $("#ugcRecipeForm")?.addEventListener("submit", submitUgcRecipe);
    $("#ugcAddStepBtn")?.addEventListener("click", () => renderUploadStepItem());
    $("#ugcStepList")?.addEventListener("click", event => {
      const btn = event.target.closest(".step-remove-btn");
      if (!btn) return;
      btn.closest(".step-upload-item")?.remove();
      if (!$("#ugcStepList")?.children.length) renderUploadStepItem();
      refreshUploadStepNumbers();
    });
    $("#ugcResetBtn")?.addEventListener("click", () => {
      $("#ugcRecipeForm")?.reset();
      resetUploadSteps();
      setUploadResult("填写菜谱后提交，系统会保存到菜谱库中。", "info");
    });
  }

  function bindPackages() {
    $("#generatePackageBtn").addEventListener("click", generatePackage);
    $("#packagePreset").addEventListener("change", generatePackage);
  }

  function scoreForPreset(recipe, preset) {
    let score = 0;
    if (preset.scenes) score += recipe.scenes.filter(s => preset.scenes.includes(s)).length * 16;
    if (preset.health) score += recipe.healthTags.filter(t => preset.health.includes(t)).length * 12;
    if (preset.seasons) score += recipe.seasons.some(s => preset.seasons.includes(s) || s === "四季通用" || s === "全年") ? 10 : 0;
    if (preset.maxMinutes && recipe.minutes && recipe.minutes <= preset.maxMinutes) score += 10;
    if (preset.maxCalories && getRecipeNutrition(recipe).perServingCalories && getRecipeNutrition(recipe).perServingCalories <= preset.maxCalories) score += 10;
    if (recipe.calorieLevel.includes("低") || recipe.calorieLevel.includes("超低")) score += 4;
    return score;
  }

  function matchSlot(recipe, slot) {
    const category = String(recipe.category || "");
    const normalizedSlot = String(slot || "").split(/[\/、]/)[0];
    if (!normalizedSlot) return false;
    if (category.includes(normalizedSlot)) return true;
    if (normalizedSlot === "甜品" && /甜品|饮品|小吃|早餐/.test(category)) return true;
    if (normalizedSlot === "饮品" && /饮品|汤羹|早餐/.test(category)) return true;
    if (normalizedSlot === "主食" && /主食|早餐|粥|面|饭/.test(category + recipe.name)) return true;
    if (normalizedSlot === "汤羹" && /汤|羹|粥/.test(category + recipe.name)) return true;
    return false;
  }

  function pickForSlot(candidates, slot, usedIds) {
    const pool = Array.isArray(candidates) ? candidates : [];
    const slotCandidates = pool.filter(r => r && !usedIds.has(r.id) && matchSlot(r, slot));
    const fallback = pool.filter(r => r && !usedIds.has(r.id));
    return (slotCandidates[0] || fallback[0] || null);
  }

  function generatePackage() {
    const key = $("#packagePreset").value;
    const preset = { ...packagePresets[key] };
    if (key === "seasonal") preset.seasons = [getCurrentSeason()];
    let candidates = recipes
      .map(r => ({ ...r, _presetScore: scoreForPreset(r, preset) }))
      .sort((a, b) => (b._presetScore - a._presetScore) || (a.calories ?? 9999) - (b.calories ?? 9999));
    const positiveCandidates = candidates.filter(r => r._presetScore > 0);
    if (positiveCandidates.length) candidates = positiveCandidates;

    const used = new Set();
    const selected = [];
    (preset.slots || ["热菜", "凉菜", "汤羹"]).forEach(slot => {
      const found = pickForSlot(candidates, slot, used);
      if (found) {
        selected.push({ slot, recipe: found });
        used.add(found.id);
      }
    });

    if (!selected.length) {
      $("#packageResult").innerHTML = `<div class="empty-state">当前数据未能生成套餐，请换一个场景。</div>`;
      return;
    }
    const calorieReference = selected.reduce((sum, item) => sum + (getRecipeNutrition(item.recipe).perServingCalories || 0), 0);
    const minuteMax = Math.max(...selected.map(item => item.recipe.minutes || 0));
    $("#packageResult").innerHTML = `
      <article class="package-card">
        <h3>${escapeHtml(preset.name)}</h3>
        <p class="meta-line">${escapeHtml(preset.description)}</p>
        <ul>
          ${selected.map(item => `<li class="package-dish-row detail-clickable" data-open-detail="${item.recipe.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(item.recipe.name)}详情"><strong>${escapeHtml(item.slot)}：</strong><span class="package-dish-name">${escapeHtml(item.recipe.name)}</span> <span class="meta-line">${escapeHtml(nutritionText(item.recipe))} · ${escapeHtml(item.recipe.timeLabel)}</span></li>`).join("")}
        </ul>
        <div class="package-total">
          <span class="tag">合计每份热量估算：${calorieReference} 千卡</span>
          <span class="tag">最长单菜用时：${minuteMax} 分钟</span>
          <span class="tag">菜品数：${selected.length}</span>
        </div>
        <p class="package-note">热量按每道菜的用料克数和常见食材营养值估算，用于套餐比较；实际摄入仍会随成品重量和食用份量变化。</p>
      </article>
      <section class="package-alternatives" aria-label="可替换菜品">
        <div class="package-alt-head">
          <h3>候补菜品</h3>
          <p>可以替换进套餐，点击查看详情</p>
        </div>
        <div class="package-alt-grid">
          ${candidates.filter(r => !used.has(r.id)).slice(0, 6).map(r => `
            <article class="package-alt-card detail-clickable" data-open-detail="${r.id}" tabindex="0" role="button" aria-label="查看${escapeHtml(r.name)}详情">
              <div class="package-alt-thumb">${recipeImageHtml(r, "package-alt-img", "菜品图片")}</div>
              <div class="package-alt-copy">
                <h4>${escapeHtml(r.name)}</h4>
                <p class="meta-line">${escapeHtml(r.taste)} · ${escapeHtml(r.timeLabel)} · ${escapeHtml(nutritionText(r))}</p>
                <div class="tag-row compact-tags">${[...r.healthTags.slice(0, 2), ...r.scenes.slice(0, 1)].map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
    bindCardButtons($("#packageResult"));
  }

  function updateStats() {
    const total = $("#statTotal");
    const ingredients = $("#statIngredients");
    const favorites = $("#statFavorites");
    if (total) total.textContent = recipes.length;
    if (ingredients) ingredients.textContent = safeList(meta.ingredients).length;
    if (favorites) favorites.textContent = getFavorites().length;
  }

  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => el.hidden = true, 1800);
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function initTheme() {
    const theme = storageGet("recipeTheme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      $("#themeToggle").textContent = "☀️";
    }
  }

  async function init() {
    initTheme();
    await loadDatabaseData();
    if (dataLoadError) {
      const summary = document.querySelector("#resultSummary");
      const grid = document.querySelector("#recipeGrid");
      if (summary) summary.textContent = dataLoadError;
      if (grid && !recipes.length) grid.innerHTML = `<div class="empty-state">${escapeHtml(dataLoadError)}<br>请确认已在 Navicat 执行 V47 初始化 SQL，并在 .env 中填写 MYSQL_HOST、MYSQL_PORT、MYSQL_USER、MYSQL_PASSWORD、MYSQL_DATABASE。</div>`;
    }
    updateStats();
    if (dataLoadError && !recipes.length) {
      renderOptions();
      bindFilters();
      bindTabs();
      bindAiTool();
      bindUploadTool();
      bindPackages();
      syncPageChrome(state.currentTab);
      window.addEventListener("hashchange", renderRoute);
      return;
    }
    renderOptions();
    bindFilters();
    bindTabs();
    bindAiTool();
    bindUploadTool();
    bindPackages();
    renderChipList("ingredients", "selectedIngredients");
    renderChipList("excludedSeasonings", "excludedSeasonings");
    renderHomeRecommendations();
    syncPageChrome(state.currentTab);
    renderRecipes();
    generatePackage();
    renderRoute();
    window.addEventListener("hashchange", renderRoute);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
