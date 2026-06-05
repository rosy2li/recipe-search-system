-- 食光菜谱 V47 MySQL 数据库结构
-- 目标库名：recipe；字符集：utf8mb4；引擎：InnoDB。
-- 可直接在 Navicat 的 joker/root 连接中新建查询执行。

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `recipe` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `recipe`;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS `v_recipe_full`;
DROP TABLE IF EXISTS `recipe_image`;
DROP TABLE IF EXISTS `recipe_step`;
DROP TABLE IF EXISTS `recipe_tag`;
DROP TABLE IF EXISTS `tag`;
DROP TABLE IF EXISTS `recipe_ingredient`;
DROP TABLE IF EXISTS `ingredient`;
DROP TABLE IF EXISTS `recipe`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `recipe` (
  `recipe_id` VARCHAR(20) NOT NULL COMMENT '菜谱编号，如 R0001',
  `recipe_name` VARCHAR(100) NOT NULL COMMENT '菜名',
  `recipe_image` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '封面图路径',
  `category` VARCHAR(50) DEFAULT NULL COMMENT '菜品类型，如热菜/凉菜/主食',
  `taste` VARCHAR(50) DEFAULT NULL COMMENT '口味',
  `cooking_method` VARCHAR(50) DEFAULT NULL COMMENT '烹饪方式',
  `cooking_time` VARCHAR(50) DEFAULT NULL COMMENT '展示用烹饪时长',
  `cooking_minutes` INT DEFAULT NULL COMMENT '数值化烹饪分钟数',
  `difficulty` VARCHAR(50) DEFAULT NULL COMMENT '难度',
  `calories` VARCHAR(80) DEFAULT NULL COMMENT '热量文本',
  `calories_value` INT DEFAULT NULL COMMENT '每100g热量估算值',
  `calorie_level` VARCHAR(50) DEFAULT NULL COMMENT '热量等级',
  `health_type` VARCHAR(255) DEFAULT NULL COMMENT '健康标签聚合',
  `suitable_season` VARCHAR(255) DEFAULT NULL COMMENT '适合季节聚合',
  `suitable_scene` VARCHAR(255) DEFAULT NULL COMMENT '适合场景聚合',
  `suitable_festival` VARCHAR(255) DEFAULT NULL COMMENT '适合节日聚合',
  `source` VARCHAR(100) DEFAULT NULL COMMENT '数据来源',
  `created_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`recipe_id`),
  KEY `idx_recipe_name` (`recipe_name`),
  KEY `idx_recipe_health` (`health_type`),
  KEY `idx_recipe_scene` (`suitable_scene`),
  KEY `idx_recipe_calorie` (`calories_value`),
  KEY `idx_recipe_time` (`cooking_minutes`),
  KEY `idx_recipe_method` (`cooking_method`),
  KEY `idx_recipe_taste` (`taste`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱主表';

CREATE TABLE `ingredient` (
  `ingredient_id` INT NOT NULL AUTO_INCREMENT COMMENT '食材ID',
  `ingredient_name` VARCHAR(100) NOT NULL COMMENT '食材名称',
  `ingredient_type` VARCHAR(50) DEFAULT NULL COMMENT '食材分类',
  `alias` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '同义词/归一名称',
  `is_allergen` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否常见过敏源',
  `common_incompatible_ingredients` TEXT COMMENT '常见慎搭食材，当前版本保留字段',
  `incompatible_note` TEXT COMMENT '慎搭说明，当前版本保留字段',
  `allergen_type` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '过敏源类型',
  `notes` VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`ingredient_id`),
  UNIQUE KEY `uk_ingredient_name` (`ingredient_name`),
  KEY `idx_ingredient_name` (`ingredient_name`),
  KEY `idx_ingredient_type` (`ingredient_type`),
  KEY `idx_ingredient_allergen` (`is_allergen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='食材表';

CREATE TABLE `recipe_ingredient` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipe_id` VARCHAR(20) NOT NULL,
  `ingredient_id` INT NOT NULL,
  `ingredient_role` VARCHAR(50) DEFAULT NULL COMMENT '主料/辅料/调味料',
  `amount` VARCHAR(100) DEFAULT NULL COMMENT '用量文本',
  `required_status` VARCHAR(50) NOT NULL DEFAULT '必需',
  `substitute` VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recipe_ingredient` (`recipe_id`, `ingredient_id`, `ingredient_role`, `amount`),
  KEY `idx_recipe_ing_recipe` (`recipe_id`),
  KEY `idx_recipe_ing_ing` (`ingredient_id`),
  CONSTRAINT `fk_recipe_ingredient_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipe` (`recipe_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_recipe_ingredient_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredient` (`ingredient_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱-食材关系表';

CREATE TABLE `recipe_step` (
  `step_id` INT NOT NULL AUTO_INCREMENT,
  `recipe_id` VARCHAR(20) NOT NULL,
  `step_no` INT NOT NULL COMMENT '步骤序号，从1开始',
  `step_text` TEXT NOT NULL COMMENT '步骤说明',
  `step_image` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '步骤图路径',
  PRIMARY KEY (`step_id`),
  UNIQUE KEY `uk_recipe_step` (`recipe_id`, `step_no`),
  KEY `idx_step_recipe` (`recipe_id`),
  CONSTRAINT `fk_recipe_step_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipe` (`recipe_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱步骤表';

CREATE TABLE `recipe_image` (
  `image_id` INT NOT NULL AUTO_INCREMENT,
  `recipe_id` VARCHAR(20) NOT NULL,
  `image_type` ENUM('cover','step','extra') NOT NULL DEFAULT 'step',
  `image_path` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `step_no` INT DEFAULT NULL,
  PRIMARY KEY (`image_id`),
  KEY `idx_recipe_image_path` (`recipe_id`, `image_path`),
  KEY `idx_image_recipe` (`recipe_id`),
  CONSTRAINT `fk_recipe_image_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipe` (`recipe_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱图片表';

CREATE TABLE `tag` (
  `tag_id` INT NOT NULL AUTO_INCREMENT,
  `tag_name` VARCHAR(100) NOT NULL,
  `tag_type` VARCHAR(50) NOT NULL COMMENT '菜品类型/口味/做法/难度/热量等级/健康/季节/场景/节日',
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `uk_tag_name_type` (`tag_name`, `tag_type`),
  KEY `idx_tag_name` (`tag_name`),
  KEY `idx_tag_type` (`tag_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='检索标签表';

CREATE TABLE `recipe_tag` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipe_id` VARCHAR(20) NOT NULL,
  `tag_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recipe_tag` (`recipe_id`, `tag_id`),
  KEY `idx_recipe_tag_recipe` (`recipe_id`),
  KEY `idx_recipe_tag_tag` (`tag_id`),
  CONSTRAINT `fk_recipe_tag_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipe` (`recipe_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_recipe_tag_tag` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`tag_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱-标签关系表';

CREATE OR REPLACE VIEW `v_recipe_full` AS
SELECT
  r.`recipe_id`,
  r.`recipe_name`,
  r.`category`,
  r.`taste`,
  r.`cooking_method`,
  r.`cooking_minutes`,
  r.`difficulty`,
  r.`calories_value`,
  r.`calorie_level`,
  r.`health_type`,
  r.`suitable_season`,
  r.`suitable_scene`,
  GROUP_CONCAT(DISTINCT i.`ingredient_name` ORDER BY i.`ingredient_name` SEPARATOR '、') AS `ingredients`,
  GROUP_CONCAT(DISTINCT CONCAT(t.`tag_type`, ':', t.`tag_name`) ORDER BY t.`tag_type`, t.`tag_name` SEPARATOR '、') AS `tags`
FROM `recipe` r
LEFT JOIN `recipe_ingredient` ri ON ri.`recipe_id` = r.`recipe_id`
LEFT JOIN `ingredient` i ON i.`ingredient_id` = ri.`ingredient_id`
LEFT JOIN `recipe_tag` rt ON rt.`recipe_id` = r.`recipe_id`
LEFT JOIN `tag` t ON t.`tag_id` = rt.`tag_id`
GROUP BY r.`recipe_id`;
