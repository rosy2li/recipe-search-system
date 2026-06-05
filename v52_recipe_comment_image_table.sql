-- V52：评论图片表
-- 用途：支持每条评论最多上传 6 张图片。
-- 执行方式：在已存在 recipe_comment 表的同一个 MySQL 数据库中运行本文件。

CREATE TABLE IF NOT EXISTS recipe_comment_image (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论图片ID',
  comment_id BIGINT UNSIGNED NOT NULL COMMENT '评论ID',
  image_path VARCHAR(500) NOT NULL COMMENT '图片相对路径',
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '排序，从1开始',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_comment_image_comment (comment_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜谱评论图片表';
