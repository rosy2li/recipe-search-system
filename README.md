# 食光菜谱

V52 在 V51 的社区讨论基础上继续小步修改：

- 评论区支持上传照片，单条评论最多 6 张。
- 评论图片支持 png、jpg/jpeg、webp、gif，每张默认最大 5MB。
- 评论列表会展示评论照片，点击图片可在新窗口查看原图。
- 后端新增评论图片保存目录：`assets/comment_uploads/<comment_id>/`。
- 新增数据库表：`recipe_comment_image`，SQL 文件为 `v52_recipe_comment_image_table.sql`。

运行方式不变：

```bash
pip install -r requirements.txt
python server.py
```

首次使用 V52 评论图片功能前，请在已有 V51 评论表基础上，单独执行：

```sql
source v52_recipe_comment_image_table.sql;
```

`.env` 已按原包保留。
