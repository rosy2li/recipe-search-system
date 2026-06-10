# 食光菜谱 V48 交付说明

本包为数据库驱动版：运行主系统需要先导入 V47 数据库初始化 SQL，并通过 `python server.py` 启动后端。前端数据来源为 MySQL，不再加载 `src/data/recipes.js`。

V47 最终总结用 SQL 已放在：

```text
database/v47_summary_sql/00_full_import_recipe_V47_fix1.sql
database/v47_summary_sql/01_schema_V47_fix1.sql
```
