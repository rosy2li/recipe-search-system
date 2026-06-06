-- V51 社区讨论：菜谱评论表
-- 使用方法：在 Navicat / MySQL 客户端中选择 recipe 数据库后执行本文件。
-- 本 SQL 只需要执行一次，后续版本可继续复用这张表。

CREATE TABLE IF NOT EXISTS `recipe_comment` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `recipe_id` VARCHAR(20) NOT NULL COMMENT '菜谱编号，对应 recipe.recipe_id',
  `nickname` VARCHAR(40) NOT NULL DEFAULT '食友' COMMENT '评论昵称',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `rating` TINYINT UNSIGNED NULL COMMENT '评分：1-5，可为空',
  `status` VARCHAR(20) NOT NULL DEFAULT 'visible' COMMENT '状态：visible/hidden/deleted',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_recipe_comment_recipe_time` (`recipe_id`, `created_at`),
  KEY `idx_recipe_comment_status` (`status`),
  CONSTRAINT `fk_recipe_comment_recipe`
    FOREIGN KEY (`recipe_id`) REFERENCES `recipe` (`recipe_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱社区评论表';
