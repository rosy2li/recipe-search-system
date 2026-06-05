# V48 数据说明

V48 起，前端不再默认加载 `recipes.js` / `recipes.json`。菜谱数据由 `server.py` 连接 MySQL 后通过 `/api/bootstrap` 提供。
