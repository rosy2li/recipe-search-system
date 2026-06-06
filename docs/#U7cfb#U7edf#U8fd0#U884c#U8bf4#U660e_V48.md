# 食光菜谱 V48｜数据库驱动版

V48 在 V47 MySQL 数据库基础上完成主系统数据源切换：前端不再加载 `src/data/recipes.js`，而是由 `server.py` 连接 MySQL，通过 `/api/bootstrap` 把菜谱、食材、步骤、图片、标签数据提供给页面。

## 1. 运行前准备

需要先保证你的 MySQL 中已经有 V47 初始化好的 `recipe` 数据库。也就是先在 Navicat 里执行过 V47 的完整导入 SQL。

`.env` 中至少需要有：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的MySQL密码
MYSQL_DATABASE=recipe
PORT=8000
```

如需 AI 问菜真实模型，再保留/填写：

```env
ZHIPUAI_API_KEY=你的智谱API_KEY
ZHIPUAI_MODEL=glm-4-flash-250414
```

## 2. 启动方式

在项目根目录打开终端：

```bash
pip install -r requirements.txt
python server.py
```

浏览器打开：

```text
http://127.0.0.1:8000
```

注意：V48 不能直接双击 `index.html` 运行，因为数据来自后端 MySQL 接口。

## 3. V48 接口

```text
GET  /api/bootstrap        前端启动时读取全部菜谱与筛选元数据
GET  /api/db-summary       检查数据库表数量
GET  /api/search?q=番茄    数据库接口检索测试
GET  /api/recipes/R0001    读取单道菜详情
GET  /api/tags             读取标签
GET  /api/ingredients      读取食材
POST /api/ai-ask           AI 问菜代理接口
```

## 4. V48 与 V47 的区别

```text
V47：完成 MySQL 建库、建表、插入 55 条菜谱数据；主页面仍主要使用前端 recipes.js。
V48：主页面启动时从 MySQL 读取数据，前端不再默认携带完整菜谱数据文件。
```

## 5. 最终总结可用说明

本版本体现了系统由静态数据驱动向数据库驱动的升级。菜谱基础信息、食材、步骤、图片和标签已经规范化存储在 MySQL 中，前端通过后端 API 获取数据，提升了数据维护性和后续扩展能力。
