# V54 云数据库缓存优化版说明

## 为什么要改

V53 在读取首页 `/api/bootstrap` 时，会先查出所有菜谱编号，再对每一道菜分别查询基础信息、食材和步骤。使用本地 MySQL 时延迟较小，但迁移到 TiDB Cloud 后，每一次 SQL 都需要跨网络访问，几十道菜就可能产生上百次请求，导致首页长时间加载甚至浏览器中断连接。

V54 保留“前端一次性拿到全部菜谱数据”的设计，但把后端改成：

1. 批量查询菜谱、食材、步骤，减少 SQL 次数；
2. 第一次访问 `/api/bootstrap` 时生成内存缓存；
3. 后续访问直接返回缓存；
4. 上传新菜谱后自动清空缓存，下次访问会重新生成。

## .env 配置示例

本地 MySQL：

```env
PORT=8000
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=Root@123456
MYSQL_DATABASE=recipe
MYSQL_SSL=false
```

TiDB Cloud：

```env
PORT=8000
MYSQL_HOST=你的 TiDB Host
MYSQL_PORT=4000
MYSQL_USER=你的 TiDB 用户名
MYSQL_PASSWORD=你的 TiDB 密码
MYSQL_DATABASE=recipe
MYSQL_SSL=true
MYSQL_CONNECT_TIMEOUT=10
MYSQL_READ_TIMEOUT=30
MYSQL_WRITE_TIMEOUT=30
BOOTSTRAP_CACHE_TTL=3600
```

## 测试方式

启动：

```bash
python server.py
```

先测试数据库：

```text
http://127.0.0.1:8000/api/db-summary
```

再测试首页数据：

```text
http://127.0.0.1:8000/api/bootstrap
```

强制刷新缓存：

```text
http://127.0.0.1:8000/api/bootstrap?refresh=1
```

## 报告可写表述

为减少云数据库频繁访问带来的网络延迟，系统采用启动预加载与内存缓存机制。后端在首次访问首页数据接口时，批量读取菜谱基础信息、食材信息和步骤信息，并将结果缓存于服务器内存中。后续检索、推荐与页面展示主要基于缓存数据完成，从而减少重复 SQL 查询次数，提高系统响应速度。用户上传新菜谱后，系统会自动清空缓存并在下一次访问时重新生成，保证数据更新后仍能被检索到。
