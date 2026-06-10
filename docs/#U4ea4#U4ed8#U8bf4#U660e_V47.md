# V47 交付说明

本版本基于 V46 页面和数据结构整理，重点补齐 MySQL 数据库交付文件，并按项目要求保留 `.env`。

## 本次调整

- 系统包名升级为 `recipe_search_system_v47_mysql_ready`。
- 前端入口改为引用 `src/app.v47.js` 和 `src/styles.v47.css`。
- `window.__RECIPE_SYSTEM_VERSION__` 更新为 `V47`。
- MySQL 建库、建表、初始化数据脚本统一标注为 V47。
- 保留 `.env`，同时保留 `.env.example`。
- 新增 MySQL 导入说明、数据库设计说明和校验脚本。

## 导入入口

Navicat 中运行：

```sql
database/mysql/00_full_import_recipe.sql
```

导入后运行：

```sql
database/mysql/03_check_counts.sql
```

## 说明

`.env` 已按你的要求保留在压缩包中，适合本机或内部演示使用。若后续要公开提交，建议另行制作去除 `.env` 的公开版。
