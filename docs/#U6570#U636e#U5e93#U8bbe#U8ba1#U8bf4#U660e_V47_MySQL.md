# 数据库设计说明：食光菜谱 V47 MySQL 版

## 一、设计目标

本数据库用于支撑“食光菜谱”系统中的菜谱存储、食材检索、标签筛选、步骤展示和图片管理。相较于前端 JSON 数据，MySQL 版本将菜谱、食材、步骤、图片、标签拆分为规范化表结构，便于后续扩展后端接口和课程答辩展示。

## 二、ER 关系说明

```text
recipe 1 ── N recipe_step
recipe 1 ── N recipe_image
recipe N ── N ingredient，通过 recipe_ingredient 实现
recipe N ── N tag，通过 recipe_tag 实现
```

## 三、表结构摘要

| 表名 | 作用 | 当前记录数 |
|---|---|---:|
| recipe | 菜谱主表 | 55 |
| ingredient | 食材表 | 125 |
| recipe_ingredient | 菜谱与食材关系 | 317 |
| recipe_step | 做法步骤 | 226 |
| recipe_image | 封面图与步骤图 | 281 |
| tag | 检索标签 | 96 |
| recipe_tag | 菜谱与标签关系 | 740 |

## 四、主要字段说明

### 1. recipe

- `recipe_id`：菜谱编号，如 R0001。
- `recipe_name`：菜名。
- `recipe_image`：封面图路径。
- `category`：菜品类型。
- `taste`：口味。
- `cooking_method`：做法。
- `cooking_minutes`：数值化时长，便于排序和筛选。
- `calories_value`：数值化热量估算，便于热量筛选。
- `health_type`：健康标签聚合，用于三高、减脂等场景。
- `suitable_scene`：适合场景，如早餐、晚餐、减脂等。

### 2. ingredient

- `ingredient_name`：食材名称，唯一。
- `ingredient_type`：食材类型，如蔬菜类、肉蛋类、调味料等。
- `alias`：同义词归一字段，如西红柿归一到番茄。
- `is_allergen`：是否属于常见过敏源。
- `allergen_type`：过敏源类型，如蛋类、海鲜、豆制品等。

### 3. recipe_ingredient

该表记录每道菜使用哪些食材，以及食材角色和用量。

### 4. recipe_step

该表将每一步做法拆成独立记录，和步骤图一一绑定，适合详情页展示。

### 5. tag / recipe_tag

标签分为菜品类型、口味、做法、难度、热量等级、健康、季节、场景、节日。这样可以避免把所有筛选条件都硬编码在菜谱主表中。

## 五、常用查询示例

### 查询一道菜详情

```sql
SELECT * FROM recipe WHERE recipe_id = 'R0001';
```

### 查询某道菜的食材

```sql
SELECT r.recipe_name, i.ingredient_name, ri.ingredient_role, ri.amount
FROM recipe r
JOIN recipe_ingredient ri ON ri.recipe_id = r.recipe_id
JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
WHERE r.recipe_id = 'R0001';
```

### 查询含番茄的菜谱

```sql
SELECT DISTINCT r.recipe_id, r.recipe_name
FROM recipe r
JOIN recipe_ingredient ri ON ri.recipe_id = r.recipe_id
JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
WHERE i.ingredient_name LIKE '%番茄%';
```

### 查询低卡且 15 分钟内的菜谱

```sql
SELECT recipe_id, recipe_name, cooking_minutes, calories_value
FROM recipe
WHERE calorie_level = '低卡'
  AND cooking_minutes <= 15
ORDER BY cooking_minutes ASC, calories_value ASC;
```

### 查询适合减脂场景的菜谱

```sql
SELECT recipe_id, recipe_name, health_type, suitable_scene
FROM recipe
WHERE suitable_scene LIKE '%减脂%'
   OR health_type LIKE '%减脂%';
```

## 六、后续接入建议

当前 V47 前端仍默认读取 `src/data/recipes.js`，这保证了展示稳定。若后续要求“数据库真正参与检索”，建议将前端检索改为请求后端：

```text
/api/search
/api/recipes/:id
/api/db-summary
```

本包已经提供 `server_mysql.py` 作为 MySQL API 雏形，可以作为下一版后端接入基础。
