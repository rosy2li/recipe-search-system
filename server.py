"""
食光菜谱社区讨论版服务器。

运行前：
  1. 先在 Navicat 中执行数据库初始化 SQL，确保 recipe 库和数据已存在。
  2. 在 .env 中填写 MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE。
  3. 安装依赖：pip install -r requirements.txt
  4. 启动：python server.py
  5. 浏览器打开：http://127.0.0.1:8000

说明：
  - 继承 MySQL 数据库驱动模式。
  - 提供 /api/user-recipes，支持用户上传菜谱并写入现有 MySQL 表。
  - /api/bootstrap 会统一读取系统菜谱和用户上传菜谱。
  - /api/ai-ask 保留智谱 GLM 代理能力，候选菜谱来自数据库读取后的结果。
"""
from __future__ import annotations

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import base64
import binascii
import json
import os
import re
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8000"))
DEFAULT_ZHIPUAI_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
DEFAULT_MODEL = "glm-4-flash-250414"
MAX_UPLOAD_JSON_BYTES = int(os.environ.get("MAX_UPLOAD_JSON_BYTES", str(64 * 1024 * 1024)))
MAX_COVER_IMAGE_BYTES = int(os.environ.get("MAX_COVER_IMAGE_BYTES", str(5 * 1024 * 1024)))
MAX_COMMENT_IMAGE_BYTES = int(os.environ.get("MAX_COMMENT_IMAGE_BYTES", str(5 * 1024 * 1024)))
MAX_COMMENT_IMAGES = int(os.environ.get("MAX_COMMENT_IMAGES", "6"))


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def get_conn():
    try:
        import pymysql
    except ImportError as exc:
        raise RuntimeError("缺少 pymysql，请先执行：pip install -r requirements.txt") from exc
    return pymysql.connect(
        host=os.environ.get("MYSQL_HOST", "localhost"),
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ.get("MYSQL_USER", "root"),
        password=os.environ.get("MYSQL_PASSWORD", ""),
        database=os.environ.get("MYSQL_DATABASE", "recipe"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict | list) -> None:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(data)


def read_json_body(handler: SimpleHTTPRequestHandler, max_bytes: int = 160_000) -> dict:
    length = int(handler.headers.get("Content-Length", "0") or "0")
    if length <= 0:
        return {}
    if length > max_bytes:
        raise ValueError("请求内容过大")
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def split_cn_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [x.strip() for x in re.split(r"[、,，/]+", str(value)) if x.strip()]


def recipe_to_frontend(row: dict, ingredients: list[dict] | None = None, steps: list[dict] | None = None) -> dict:
    item = {
        "id": row["recipe_id"],
        "name": row["recipe_name"],
        "image": row.get("recipe_image") or "",
        "category": row.get("category") or "",
        "taste": row.get("taste") or "",
        "method": row.get("cooking_method") or "",
        "timeLabel": row.get("cooking_time") or "",
        "minutes": row.get("cooking_minutes"),
        "difficulty": row.get("difficulty") or "",
        "caloriesText": row.get("calories") or "",
        "calories": row.get("calories_value"),
        "calorieLevel": row.get("calorie_level") or "",
        "healthTags": split_cn_list(row.get("health_type")),
        "seasons": split_cn_list(row.get("suitable_season")),
        "scenes": split_cn_list(row.get("suitable_scene")),
        "festivals": split_cn_list(row.get("suitable_festival")),
        "source": row.get("source") or "",
        "isUserGenerated": str(row.get("source") or "").startswith("用户上传") or str(row.get("recipe_id") or "").startswith("U"),
    }
    if ingredients is not None:
        item["ingredients"] = [
            {
                "name": i.get("ingredient_name") or "",
                "role": i.get("ingredient_role") or "",
                "amount": i.get("amount") or "",
                "type": i.get("ingredient_type") or "",
            }
            for i in ingredients
        ]
    if steps is not None:
        item["steps"] = [s.get("step_text") or "" for s in steps]
        item["stepImages"] = [s.get("step_image") or "" for s in steps]
        item["images"] = [item["image"]] + [x for x in item["stepImages"] if x]
    else:
        item["ingredients"] = []
        item["steps"] = []
        item["stepImages"] = []
        item["images"] = [item["image"]] if item["image"] else []
    return item


def fetch_recipe(recipe_id: str) -> dict | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM recipe WHERE recipe_id=%s", (recipe_id,))
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                """
                SELECT i.ingredient_name, i.ingredient_type, ri.ingredient_role, ri.amount
                FROM recipe_ingredient ri
                JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
                WHERE ri.recipe_id=%s
                ORDER BY ri.id
                """,
                (recipe_id,),
            )
            ingredients = cur.fetchall()
            cur.execute(
                "SELECT step_no, step_text, step_image FROM recipe_step WHERE recipe_id=%s ORDER BY step_no",
                (recipe_id,),
            )
            steps = cur.fetchall()
    return recipe_to_frontend(row, ingredients, steps)


def fetch_all_recipes() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT recipe_id FROM recipe ORDER BY recipe_id")
            ids = [row["recipe_id"] for row in cur.fetchall()]
    recipes = []
    for recipe_id in ids:
        recipe = fetch_recipe(recipe_id)
        if recipe:
            recipes.append(recipe)
    return recipes


def unique_sorted(values: list[str]) -> list[str]:
    return sorted({v for v in values if v and v != "无"})


def fetch_meta(recipes: list[dict]) -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT ingredient_name, ingredient_type FROM ingredient ORDER BY ingredient_name")
            ing_rows = cur.fetchall()
            ingredients = [r["ingredient_name"] for r in ing_rows]
            seasonings = [r["ingredient_name"] for r in ing_rows if "调味" in str(r.get("ingredient_type") or "")]
    meta = {
        "total": len(recipes),
        "categories": unique_sorted([r.get("category", "") for r in recipes]),
        "tastes": unique_sorted([r.get("taste", "") for r in recipes]),
        "methods": unique_sorted([r.get("method", "") for r in recipes]),
        "difficulties": unique_sorted([r.get("difficulty", "") for r in recipes]),
        "calorieLevels": unique_sorted([r.get("calorieLevel", "") for r in recipes]),
        "healthTags": unique_sorted([x for r in recipes for x in r.get("healthTags", [])]),
        "seasons": unique_sorted([x for r in recipes for x in r.get("seasons", [])]),
        "scenes": unique_sorted([x for r in recipes for x in r.get("scenes", [])]),
        "festivals": unique_sorted([x for r in recipes for x in r.get("festivals", [])]),
        "ingredients": ingredients,
        "seasonings": seasonings,
        "version": "community-recipe-upload",
        "source_file": "MySQL database",
    }
    return meta


def fetch_bootstrap() -> dict:
    recipes = fetch_all_recipes()
    return {"recipes": recipes, "meta": fetch_meta(recipes)}


def search_recipes(params: dict) -> list[dict]:
    q = (params.get("q") or [""])[0].strip()
    taste = (params.get("taste") or [""])[0].strip()
    method = (params.get("method") or [""])[0].strip()
    difficulty = (params.get("difficulty") or [""])[0].strip()
    scene = (params.get("scene") or [""])[0].strip()
    season = (params.get("season") or [""])[0].strip()
    health = (params.get("health") or [""])[0].strip()
    max_minutes = (params.get("maxMinutes") or [""])[0].strip()
    limit = int((params.get("limit") or ["30"])[0] or 30)
    limit = max(1, min(limit, 100))

    where = []
    args: list[object] = []
    joins = """
      LEFT JOIN recipe_ingredient ri ON ri.recipe_id = r.recipe_id
      LEFT JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
      LEFT JOIN recipe_tag rt ON rt.recipe_id = r.recipe_id
      LEFT JOIN tag t ON t.tag_id = rt.tag_id
    """
    if q:
        like = f"%{q}%"
        where.append("(r.recipe_name LIKE %s OR r.category LIKE %s OR r.taste LIKE %s OR r.cooking_method LIKE %s OR i.ingredient_name LIKE %s OR t.tag_name LIKE %s)")
        args += [like, like, like, like, like, like]
    if taste:
        where.append("r.taste = %s"); args.append(taste)
    if method:
        where.append("r.cooking_method = %s"); args.append(method)
    if difficulty:
        where.append("r.difficulty = %s"); args.append(difficulty)
    if scene:
        where.append("r.suitable_scene LIKE %s"); args.append(f"%{scene}%")
    if season:
        where.append("r.suitable_season LIKE %s"); args.append(f"%{season}%")
    if health:
        where.append("r.health_type LIKE %s"); args.append(f"%{health}%")
    if max_minutes.isdigit():
        where.append("r.cooking_minutes <= %s"); args.append(int(max_minutes))
    where_sql = "WHERE " + " AND ".join(where) if where else ""
    sql = f"""
    SELECT DISTINCT r.recipe_id
    FROM recipe r
    {joins}
    {where_sql}
    ORDER BY r.recipe_id
    LIMIT %s
    """
    args.append(limit)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(args))
            ids = [row["recipe_id"] for row in cur.fetchall()]
    return [r for rid in ids if (r := fetch_recipe(rid))]




def clean_text(value, max_len: int = 255) -> str:
    text = str(value or "").strip()
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text[:max_len]


def parse_optional_int(value, minimum: int | None = None, maximum: int | None = None) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = int(float(str(value).strip()))
    except ValueError:
        return None
    if minimum is not None and number < minimum:
        number = minimum
    if maximum is not None and number > maximum:
        number = maximum
    return number


def list_from_mixed(value, max_items: int = 20, max_len: int = 50) -> list[str]:
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[、,，/\n]+", str(value or ""))
    result = []
    for item in raw_items:
        clean = clean_text(item, max_len)
        if clean and clean not in result:
            result.append(clean)
        if len(result) >= max_items:
            break
    return result


def normalize_ingredient_rows(value) -> list[dict]:
    rows: list[dict] = []
    if isinstance(value, list):
        source_rows = value
    else:
        source_rows = [line for line in str(value or "").splitlines() if line.strip()]
    for item in source_rows[:80]:
        if isinstance(item, dict):
            name = clean_text(item.get("name"), 100)
            amount = clean_text(item.get("amount"), 100)
            role = clean_text(item.get("role"), 50) or "主料"
            ingredient_type = clean_text(item.get("type"), 50)
        else:
            parts = [clean_text(x, 100) for x in re.split(r"\s*[|,，]\s*", str(item), maxsplit=2)]
            name = parts[0] if parts else ""
            amount = parts[1] if len(parts) > 1 else ""
            role = parts[2] if len(parts) > 2 else "主料"
            ingredient_type = "调味料" if "调味" in role else "用户食材"
        if not name:
            continue
        if not ingredient_type:
            ingredient_type = "调味料" if "调味" in role else "用户食材"
        rows.append({"name": name, "amount": amount, "role": role or "主料", "type": ingredient_type})
    return rows


def normalize_step_rows(value) -> list[dict]:
    if isinstance(value, list):
        raw_steps = value
    else:
        raw_steps = [{"text": line, "imageData": ""} for line in str(value or "").splitlines()]
    steps = []
    for step in raw_steps[:60]:
        if isinstance(step, dict):
            text = clean_text(step.get("text") or step.get("step") or step.get("step_text"), 800)
            image_data = clean_text(step.get("imageData") or step.get("image") or step.get("stepImageData"), MAX_UPLOAD_JSON_BYTES)
        else:
            text = clean_text(step, 800)
            image_data = ""
        if text:
            steps.append({"text": text, "imageData": image_data})
    return steps


def infer_calorie_level(calories_value: int | None, fallback: str = "") -> str:
    if fallback:
        return clean_text(fallback, 50)
    if calories_value is None:
        return ""
    if calories_value <= 80:
        return "超低卡"
    if calories_value <= 150:
        return "低卡"
    if calories_value <= 300:
        return "中等热量"
    return "高热量"


def next_ugc_recipe_id(cur) -> str:
    cur.execute("SELECT MAX(CAST(SUBSTRING(recipe_id, 2) AS UNSIGNED)) AS n FROM recipe WHERE recipe_id REGEXP '^U[0-9]+$'")
    row = cur.fetchone() or {}
    return f"U{int(row.get('n') or 0) + 1:04d}"


def save_cover_image(data_url: str, recipe_id: str) -> str:
    if not data_url:
        return ""
    match = re.match(r"^data:(image/(?:png|jpeg|jpg|webp|gif));base64,(.+)$", data_url, flags=re.I | re.S)
    if not match:
        raise ValueError("封面图格式不支持，请上传 png、jpg、webp 或 gif 图片")
    mime = match.group(1).lower()
    ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(mime)
    if not ext:
        raise ValueError("封面图格式不支持")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("封面图内容解析失败") from exc
    if len(raw) > MAX_COVER_IMAGE_BYTES:
        raise ValueError(f"封面图过大，请控制在 {MAX_COVER_IMAGE_BYTES // 1024 // 1024}MB 内")
    folder = ROOT / "assets" / "user_uploads" / recipe_id
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f"cover.{ext}"
    file_path.write_bytes(raw)
    return file_path.relative_to(ROOT).as_posix()


def save_step_image(data_url: str, recipe_id: str, step_no: int) -> str:
    if not data_url:
        return ""
    match = re.match(r"^data:(image/(?:png|jpeg|jpg|webp|gif));base64,(.+)$", data_url, flags=re.I | re.S)
    if not match:
        raise ValueError(f"第 {step_no} 步图片格式不支持，请上传 png、jpg、webp 或 gif 图片")
    mime = match.group(1).lower()
    ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(mime)
    if not ext:
        raise ValueError(f"第 {step_no} 步图片格式不支持")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"第 {step_no} 步图片内容解析失败") from exc
    if len(raw) > MAX_COVER_IMAGE_BYTES:
        raise ValueError(f"第 {step_no} 步图片过大，请控制在 {MAX_COVER_IMAGE_BYTES // 1024 // 1024}MB 内")
    folder = ROOT / "assets" / "user_uploads" / recipe_id
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f"step_{step_no:02d}.{ext}"
    file_path.write_bytes(raw)
    return file_path.relative_to(ROOT).as_posix()



def save_comment_image(data_url: str, comment_id: int, sort_order: int) -> str:
    if not data_url:
        return ""
    match = re.match(r"^data:(image/(?:png|jpeg|jpg|webp|gif));base64,(.+)$", data_url, flags=re.I | re.S)
    if not match:
        raise ValueError(f"第 {sort_order} 张评论图片格式不支持，请上传 png、jpg、webp 或 gif 图片")
    mime = match.group(1).lower()
    ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}.get(mime)
    if not ext:
        raise ValueError(f"第 {sort_order} 张评论图片格式不支持")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"第 {sort_order} 张评论图片内容解析失败") from exc
    if len(raw) > MAX_COMMENT_IMAGE_BYTES:
        raise ValueError(f"第 {sort_order} 张评论图片过大，请控制在 {MAX_COMMENT_IMAGE_BYTES // 1024 // 1024}MB 内")
    folder = ROOT / "assets" / "comment_uploads" / str(comment_id)
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f"comment_{sort_order:02d}.{ext}"
    file_path.write_bytes(raw)
    return file_path.relative_to(ROOT).as_posix()

def ensure_ingredient(cur, name: str, ingredient_type: str = "用户食材") -> int:
    cur.execute("SELECT ingredient_id FROM ingredient WHERE ingredient_name=%s", (name,))
    row = cur.fetchone()
    if row:
        return int(row["ingredient_id"])
    cur.execute(
        """
        INSERT INTO ingredient (ingredient_name, ingredient_type, alias, notes)
        VALUES (%s, %s, %s, %s)
        """,
        (name, ingredient_type or "用户食材", "", "用户上传菜谱自动创建"),
    )
    return int(cur.lastrowid)


def ensure_tag(cur, tag_name: str, tag_type: str) -> int:
    cur.execute("SELECT tag_id FROM tag WHERE tag_name=%s AND tag_type=%s", (tag_name, tag_type))
    row = cur.fetchone()
    if row:
        return int(row["tag_id"])
    cur.execute("INSERT INTO tag (tag_name, tag_type, description) VALUES (%s, %s, %s)", (tag_name, tag_type, "用户上传菜谱自动创建"))
    return int(cur.lastrowid)


def link_tag(cur, recipe_id: str, tag_name: str, tag_type: str) -> None:
    tag_name = clean_text(tag_name, 100)
    if not tag_name:
        return
    tag_id = ensure_tag(cur, tag_name, tag_type)
    cur.execute("INSERT IGNORE INTO recipe_tag (recipe_id, tag_id) VALUES (%s, %s)", (recipe_id, tag_id))


def add_recipe_tags(cur, recipe_id: str, fields: dict) -> None:
    single_tags = [
        (fields.get("category"), "菜品类型"),
        (fields.get("taste"), "口味"),
        (fields.get("method"), "做法"),
        (fields.get("difficulty"), "难度"),
        (fields.get("calorie_level"), "热量等级"),
    ]
    for name, tag_type in single_tags:
        link_tag(cur, recipe_id, name, tag_type)
    for name in fields.get("health_tags", []):
        link_tag(cur, recipe_id, name, "健康")
    for name in fields.get("seasons", []):
        link_tag(cur, recipe_id, name, "季节")
    for name in fields.get("scenes", []):
        link_tag(cur, recipe_id, name, "场景")
    for name in fields.get("festivals", []):
        link_tag(cur, recipe_id, name, "节日")


def create_user_recipe(data: dict) -> dict:
    name = clean_text(data.get("recipeName") or data.get("name"), 100)
    if not name:
        raise ValueError("菜名不能为空")
    ingredients = normalize_ingredient_rows(data.get("ingredients") or data.get("ingredientsText"))
    steps = normalize_step_rows(data.get("steps") or data.get("stepsText"))
    if not ingredients:
        raise ValueError("至少需要填写 1 个食材")
    if not steps:
        raise ValueError("至少需要填写 1 个步骤")

    minutes = parse_optional_int(data.get("minutes") or data.get("cookingMinutes"), 1, 999)
    calories_value = parse_optional_int(data.get("caloriesValue"), 0, 2000)
    health_tags = list_from_mixed(data.get("healthTags"), 20)
    seasons = list_from_mixed(data.get("seasons"), 20)
    scenes = list_from_mixed(data.get("scenes"), 20)
    festivals = list_from_mixed(data.get("festivals"), 20)
    category = clean_text(data.get("category"), 50) or "用户菜谱"
    taste = clean_text(data.get("taste"), 50)
    method = clean_text(data.get("method"), 50)
    difficulty = clean_text(data.get("difficulty"), 50) or "简单"
    calorie_level = infer_calorie_level(calories_value, clean_text(data.get("calorieLevel"), 50))
    cooking_time = clean_text(data.get("timeLabel") or data.get("cookingTime"), 50) or (f"{minutes}分钟" if minutes else "")
    calories_text = clean_text(data.get("caloriesText"), 80) or (f"约{calories_value}千卡/100g" if calories_value is not None else "")
    author = clean_text(data.get("author"), 40)
    source = "用户上传" + (f" · {author}" if author else "")

    conn = get_conn()
    saved_image_dir: Path | None = None
    try:
        conn.autocommit(False)
        with conn.cursor() as cur:
            recipe_id = next_ugc_recipe_id(cur)
            image_path = save_cover_image(clean_text(data.get("coverImageData"), MAX_UPLOAD_JSON_BYTES), recipe_id)
            if image_path:
                saved_image_dir = ROOT / "assets" / "user_uploads" / recipe_id
            cur.execute(
                """
                INSERT INTO recipe
                (recipe_id, recipe_name, recipe_image, category, taste, cooking_method, cooking_time,
                 cooking_minutes, difficulty, calories, calories_value, calorie_level, health_type,
                 suitable_season, suitable_scene, suitable_festival, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    recipe_id, name, image_path, category, taste, method, cooking_time, minutes,
                    difficulty, calories_text, calories_value, calorie_level,
                    "、".join(health_tags), "、".join(seasons), "、".join(scenes), "、".join(festivals), source,
                ),
            )
            seen_ingredients = set()
            for item in ingredients:
                key = (item["name"], item["role"], item["amount"])
                if key in seen_ingredients:
                    continue
                seen_ingredients.add(key)
                ingredient_id = ensure_ingredient(cur, item["name"], item.get("type") or "用户食材")
                cur.execute(
                    """
                    INSERT INTO recipe_ingredient (recipe_id, ingredient_id, ingredient_role, amount, required_status, substitute)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (recipe_id, ingredient_id, item.get("role") or "主料", item.get("amount") or "", "必需", ""),
                )
            for index, step in enumerate(steps, start=1):
                step_image = save_step_image(step.get("imageData") or "", recipe_id, index)
                if step_image:
                    saved_image_dir = ROOT / "assets" / "user_uploads" / recipe_id
                cur.execute(
                    "INSERT INTO recipe_step (recipe_id, step_no, step_text, step_image) VALUES (%s, %s, %s, %s)",
                    (recipe_id, index, step.get("text") or "", step_image),
                )
                if step_image:
                    cur.execute(
                        "INSERT INTO recipe_image (recipe_id, image_type, image_path, sort_order, step_no) VALUES (%s, %s, %s, %s, %s)",
                        (recipe_id, "step", step_image, index, index),
                    )
            if image_path:
                cur.execute(
                    "INSERT INTO recipe_image (recipe_id, image_type, image_path, sort_order, step_no) VALUES (%s, %s, %s, %s, %s)",
                    (recipe_id, "cover", image_path, 0, None),
                )
            add_recipe_tags(cur, recipe_id, {
                "category": category, "taste": taste, "method": method, "difficulty": difficulty,
                "calorie_level": calorie_level, "health_tags": health_tags,
                "seasons": seasons, "scenes": scenes, "festivals": festivals,
            })
        conn.commit()
    except Exception:
        conn.rollback()
        if saved_image_dir and saved_image_dir.exists():
            for child in saved_image_dir.iterdir():
                child.unlink(missing_ok=True)
            saved_image_dir.rmdir()
        raise
    finally:
        conn.close()

    recipe = fetch_recipe(recipe_id)
    if not recipe:
        raise RuntimeError("菜谱已写入，但回读失败")
    return recipe


def fetch_user_recipes() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT recipe_id FROM recipe
                WHERE recipe_id REGEXP '^U[0-9]+$' OR source LIKE '用户上传%%'
                ORDER BY created_time DESC, recipe_id DESC
                """
            )
            ids = [row["recipe_id"] for row in cur.fetchall()]
    return [r for rid in ids if (r := fetch_recipe(rid))]


def fetch_recipe_comments(recipe_id: str, limit: int = 50) -> list[dict]:
    recipe_id = clean_text(recipe_id, 40)
    if not recipe_id:
        return []
    limit = max(1, min(int(limit or 50), 100))
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, recipe_id, nickname, content, rating, created_at
                FROM recipe_comment
                WHERE recipe_id=%s AND status='visible'
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (recipe_id, limit),
            )
            rows = cur.fetchall()
            comment_ids = [row["id"] for row in rows]
            image_map = {cid: [] for cid in comment_ids}
            if comment_ids:
                placeholders = ",".join(["%s"] * len(comment_ids))
                cur.execute(
                    f"""
                    SELECT comment_id, image_path
                    FROM recipe_comment_image
                    WHERE comment_id IN ({placeholders})
                    ORDER BY comment_id, sort_order, id
                    """,
                    tuple(comment_ids),
                )
                for img in cur.fetchall():
                    image_map.setdefault(img.get("comment_id"), []).append(img.get("image_path") or "")
    result = []
    for row in rows:
        created = row.get("created_at")
        result.append({
            "id": row.get("id"),
            "recipeId": row.get("recipe_id"),
            "nickname": row.get("nickname") or "食友",
            "content": row.get("content") or "",
            "rating": row.get("rating"),
            "images": [x for x in image_map.get(row.get("id"), []) if x],
            "createdAt": created.strftime("%Y-%m-%d %H:%M") if hasattr(created, "strftime") else str(created or ""),
        })
    return result


def normalize_comment_images(data: dict) -> list[str]:
    raw_images = data.get("images") or data.get("imageDataList") or []
    if isinstance(raw_images, str):
        raw_images = [raw_images]
    if not isinstance(raw_images, list):
        raise ValueError("评论图片数据格式不正确")
    images = [clean_text(x, MAX_UPLOAD_JSON_BYTES) for x in raw_images if str(x or "").strip()]
    if len(images) > MAX_COMMENT_IMAGES:
        raise ValueError(f"评论图片最多上传 {MAX_COMMENT_IMAGES} 张")
    return images


def create_recipe_comment(data: dict) -> dict:
    recipe_id = clean_text(data.get("recipeId") or data.get("recipe_id"), 40)
    nickname = clean_text(data.get("nickname") or data.get("author"), 40) or "食友"
    content = clean_text(data.get("content") or data.get("comment"), 800)
    rating = parse_optional_int(data.get("rating"), 1, 5)
    images_data = normalize_comment_images(data)
    if not recipe_id:
        raise ValueError("缺少菜谱编号")
    if not content:
        raise ValueError("评论内容不能为空")
    saved_paths = []
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT recipe_id FROM recipe WHERE recipe_id=%s", (recipe_id,))
                if not cur.fetchone():
                    raise ValueError("菜谱不存在")
                cur.execute(
                    """
                    INSERT INTO recipe_comment (recipe_id, nickname, content, rating, status)
                    VALUES (%s, %s, %s, %s, 'visible')
                    """,
                    (recipe_id, nickname, content, rating),
                )
                comment_id = cur.lastrowid
                for index, image_data in enumerate(images_data, start=1):
                    image_path = save_comment_image(image_data, comment_id, index)
                    if image_path:
                        saved_paths.append(image_path)
                        cur.execute(
                            """
                            INSERT INTO recipe_comment_image (comment_id, image_path, sort_order)
                            VALUES (%s, %s, %s)
                            """,
                            (comment_id, image_path, index),
                        )
                cur.execute(
                    """
                    SELECT id, recipe_id, nickname, content, rating, created_at
                    FROM recipe_comment
                    WHERE id=%s
                    """,
                    (comment_id,),
                )
                row = cur.fetchone()
    except Exception:
        for path in saved_paths:
            target = ROOT / path
            target.unlink(missing_ok=True)
        if saved_paths:
            folder = (ROOT / saved_paths[0]).parent
            try:
                folder.rmdir()
            except OSError:
                pass
        raise
    created = row.get("created_at") if row else ""
    return {
        "id": row.get("id") if row else comment_id,
        "recipeId": row.get("recipe_id") if row else recipe_id,
        "nickname": row.get("nickname") if row else nickname,
        "content": row.get("content") if row else content,
        "rating": row.get("rating") if row else rating,
        "images": saved_paths,
        "createdAt": created.strftime("%Y-%m-%d %H:%M") if hasattr(created, "strftime") else str(created or ""),
    }

def compact_candidate(candidate: dict) -> dict:
    allowed = {
        "id", "name", "category", "taste", "method", "timeLabel", "minutes",
        "difficulty", "calorieLevel", "healthTags", "scenes", "seasons",
        "ingredients", "nutrition", "steps",
    }
    cleaned = {k: candidate.get(k) for k in allowed if k in candidate}
    if isinstance(cleaned.get("ingredients"), list):
        cleaned["ingredients"] = cleaned["ingredients"][:10]
    if isinstance(cleaned.get("steps"), list):
        cleaned["steps"] = cleaned["steps"][:3]
    return cleaned


SYSTEM_PROMPT = """你是“食光菜谱”的 AI 问菜助手。你要先像真正的饮食推荐助手一样给用户一个自然、具体、有判断力的回答，然后再把回答中提到的菜品映射到系统候选菜谱中，方便前端展示可点击菜品卡。

你的工作流程：
1. 先分析用户需求，把自然语言转成系统可检索/解释的语言，例如：食材、口味、做法、场景、时间、热量、健康目标、忌口。
2. 根据 candidates 候选菜谱选择最相关的菜品。
3. 在 ai_text 里先给出自然语言回答：说明用户适合吃什么类型、推荐思路、搭配建议。允许有 AI 的解释空间，但不要编造菜谱库之外的菜名。
4. 对每一道选中的菜，在 recipe_reasons 中说明为什么符合用户需求、好处在哪里。
5. 最后前端会把 related_recipe_ids 渲染成可点击菜品卡。

必须遵守：
1. 可以自由分析用户需求，但具体推荐菜名必须来自 candidates，不允许编造候选集之外的新菜名。
2. 如果用户需求和候选菜谱不完全匹配，要说“更接近/相对适合”，不要夸大。
3. 营养信息只能说“估算/参考”，不能说精准计算，也不能替代医生或营养师建议。
4. 回答风格要短、直接、生活化，像真实产品里的推荐解释，不要写长篇科普。
5. 输出必须是一个 JSON 对象，不要输出 Markdown，不要输出 JSON 之外的文字。

JSON 格式：
{
  "ai_title": "一句话标题，例如：适合清淡快手晚餐的几道菜",
  "ai_text": "120到260字中文回答。先分析用户需求，再说明推荐方向和搭配思路，可以自然一些。",
  "search_language": {
    "ingredients": ["系统识别出的食材"],
    "taste": ["口味"],
    "method": ["做法"],
    "scene": ["场景"],
    "health_goal": ["健康目标"],
    "time_limit": "例如 10分钟内，没有则为空字符串",
    "avoid": ["忌口/过敏源"]
  },
  "related_recipe_ids": ["候选菜谱id，最多4个"],
  "recipe_reasons": {
    "菜谱id": "40到80字，说明这道菜为什么符合用户需求以及好处"
  },
  "tips": ["一句实际做菜或搭配建议", "一句注意事项，可选"]
}
"""


def build_user_prompt(question: str, signals: dict, candidates: list[dict]) -> str:
    payload = {
        "user_question": question,
        "parsed_signals_from_local_search": signals,
        "candidates": [compact_candidate(c) for c in candidates[:8]],
        "selection_rules": [
            "先把用户自然语言需求翻译成 search_language 字段",
            "优先满足用户明确提到的食材、口味、场景、时间、健康目标和忌口",
            "如果提到时间限制，优先选择 minutes 更小的候选",
            "如果提到减脂/控糖/低脂/高蛋白，优先看 healthTags 和 nutrition.perServingCalories",
            "related_recipe_ids 必须来自 candidates 的 id 字段，最多返回4个",
            "recipe_reasons 的 key 必须对应 related_recipe_ids 中的 id",
        ],
    }
    return "请根据下面 JSON 中的用户问题、本地解析结果和候选菜谱，输出指定 JSON。注意先给出 ai_text 的自然回答，再给 related_recipe_ids 和 recipe_reasons：\n" + json.dumps(payload, ensure_ascii=False)


def extract_json_object(text: str) -> dict:
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("模型没有返回 JSON 对象")
    return json.loads(match.group(0))


def call_zhipu(question: str, signals: dict, candidates: list[dict]) -> dict:
    api_key = os.environ.get("ZHIPUAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 ZHIPUAI_API_KEY")
    endpoint = os.environ.get("ZHIPUAI_ENDPOINT", DEFAULT_ZHIPUAI_ENDPOINT).strip() or DEFAULT_ZHIPUAI_ENDPOINT
    model = os.environ.get("ZHIPUAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(question, signals, candidates)},
        ],
        "temperature": 0.25,
        "top_p": 0.8,
        "max_tokens": 900,
        "stream": False,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:600]
        raise RuntimeError(f"智谱接口返回 HTTP {exc.code}：{detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"无法连接智谱接口：{exc.reason}") from exc
    try:
        content = result["choices"][0]["message"]["content"]
    except Exception as exc:
        raise RuntimeError("智谱接口响应缺少 choices[0].message.content") from exc
    answer = extract_json_object(content)
    return {"ok": True, "model": result.get("model", model), "answer": answer, "usage": result.get("usage", {})}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_OPTIONS(self):
        if self.path.startswith("/api/"):
            json_response(self, 204, {})
        else:
            super().do_OPTIONS()

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/bootstrap":
                json_response(self, 200, {"ok": True, "data": fetch_bootstrap()})
                return
            if parsed.path == "/api/db-summary":
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        tables = ["recipe", "ingredient", "recipe_ingredient", "recipe_step", "recipe_image", "tag", "recipe_tag", "recipe_comment", "recipe_comment_image"]
                        summary = {}
                        for table in tables:
                            cur.execute(f"SELECT COUNT(*) AS c FROM `{table}`")
                            summary[table] = cur.fetchone()["c"]
                json_response(self, 200, {"ok": True, "database": os.environ.get("MYSQL_DATABASE", "recipe"), "summary": summary})
                return
            if parsed.path == "/api/search":
                data = search_recipes(parse_qs(parsed.query))
                json_response(self, 200, {"ok": True, "count": len(data), "recipes": data})
                return
            if parsed.path.startswith("/api/recipes/"):
                recipe_id = unquote(parsed.path.rsplit("/", 1)[-1]).strip()
                data = fetch_recipe(recipe_id)
                if data is None:
                    json_response(self, 404, {"ok": False, "message": "菜谱不存在"})
                else:
                    json_response(self, 200, {"ok": True, "recipe": data})
                return
            if parsed.path == "/api/ingredients":
                data = fetch_meta(fetch_all_recipes()).get("ingredients", [])
                json_response(self, 200, {"ok": True, "ingredients": data})
                return
            if parsed.path == "/api/tags":
                with get_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT tag_name, tag_type FROM tag ORDER BY tag_type, tag_name")
                        data = cur.fetchall()
                json_response(self, 200, {"ok": True, "tags": data})
                return
            if parsed.path == "/api/recipe-comments":
                params = parse_qs(parsed.query)
                recipe_id = (params.get("recipeId") or params.get("recipe_id") or [""])[0]
                limit_raw = (params.get("limit") or ["50"])[0]
                try:
                    limit = int(limit_raw)
                except ValueError:
                    limit = 50
                data = fetch_recipe_comments(recipe_id, limit)
                json_response(self, 200, {"ok": True, "count": len(data), "comments": data})
                return
            if parsed.path == "/api/user-recipes":
                data = fetch_user_recipes()
                json_response(self, 200, {"ok": True, "count": len(data), "recipes": data})
                return
            super().do_GET()
        except Exception as exc:
            json_response(self, 500, {"ok": False, "message": str(exc)})

    def do_POST(self):
        if self.path.rstrip("/") == "/api/ai-ask":
            self.handle_ai_ask()
            return
        if self.path.rstrip("/") == "/api/user-recipes":
            self.handle_create_user_recipe()
            return
        if self.path.rstrip("/") == "/api/recipe-comments":
            self.handle_create_recipe_comment()
            return
        json_response(self, 404, {"ok": False, "message": "接口不存在"})

    def handle_create_user_recipe(self):
        try:
            data = read_json_body(self, max_bytes=MAX_UPLOAD_JSON_BYTES)
            recipe = create_user_recipe(data)
            json_response(self, 201, {"ok": True, "message": "菜谱上传成功", "recipe": recipe})
        except ValueError as exc:
            json_response(self, 400, {"ok": False, "message": str(exc)})
        except Exception as exc:
            json_response(self, 500, {"ok": False, "message": str(exc)})

    def handle_create_recipe_comment(self):
        try:
            data = read_json_body(self, max_bytes=MAX_UPLOAD_JSON_BYTES)
            comment = create_recipe_comment(data)
            json_response(self, 201, {"ok": True, "message": "评论发布成功", "comment": comment})
        except ValueError as exc:
            json_response(self, 400, {"ok": False, "message": str(exc)})
        except Exception as exc:
            json_response(self, 500, {"ok": False, "message": str(exc)})

    def handle_ai_ask(self):
        try:
            data = read_json_body(self)
            question = str(data.get("question", "")).strip()
            candidates = data.get("candidates") or []
            signals = data.get("signals") or {}
            if not question:
                json_response(self, 400, {"ok": False, "message": "问题不能为空"})
                return
            if not isinstance(candidates, list) or not candidates:
                json_response(self, 400, {"ok": False, "message": "缺少数据库候选菜谱"})
                return
            result = call_zhipu(question, signals, candidates)
            json_response(self, 200, result)
        except Exception as exc:
            json_response(self, 503, {"ok": False, "message": str(exc)})


if __name__ == "__main__":
    load_dotenv()
    url = f"http://127.0.0.1:{PORT}"
    print(f"食光菜谱启动：{url}")
    print("数据接口：/api/bootstrap  /api/db-summary  /api/search?q=番茄  /api/recipes/R0001  POST /api/user-recipes  /api/recipe-comments")
    if not os.environ.get("ZHIPUAI_API_KEY"):
        print("提示：未检测到 ZHIPUAI_API_KEY，AI 问菜会自动降级为本地规则推荐。")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
