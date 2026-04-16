# OrbStack 多数据库本地验证环境说明

## 1. 目标

用于在本地 `OrbStack` 环境中快速拉起多种数据库容器，支持后续对“标准库 SQL JSON 多方言适配”方案进行联调验证。

当前优先准备以下数据库：

- PostgreSQL
- openGauss
- 人大金仓
- Oracle Free
- 达梦 8 ARM

说明：

- PostgreSQL：用于验证 `pg` 方言链路
- openGauss：用于验证高斯类数据库链路
- 人大金仓：用于验证 `kingbase` 方言链路
- Oracle Free：用于验证 `oracle` 方言链路
- 达梦 8 ARM：用于补齐 `dm` 方言链路与存储过程实库验证

## 2. 本地环境结论

当前机器环境：

- Docker Context：`orbstack`
- 运行架构：`linux/aarch64`

已确认镜像支持情况：

- `postgres:16-alpine`：支持 `arm64`
- `opengauss/opengauss:latest`：支持 `arm64`
- `gvenzl/oracle-free:23-slim-faststart`：支持 `arm64`
- `oceanbase/oceanbase-ce:latest`：支持 `arm64`
- `qinchz/dm8-arm64`：Docker Hub 页面明确面向 `arm64 / Mac M1`
- `ibmcom/db2`：仅看到 `amd64`，本机运行需额外评估仿真兼容性

公开镜像可见性情况：

- `达梦`：存在第三方镜像，但非官方维护源，稳定性需单独验证
- `人大金仓`：存在第三方镜像，但标签、架构和可用性不够稳定，建议谨慎作为本地标准验证环境

当前达梦镜像选择建议：

1. 首选 `qinchz/dm8-arm64`
2. 回退 `sizx/dm8`

原因：

- `qinchz/dm8-arm64` 命名直接对应 `arm64`
- `sizx/dm8` 在 Docker Hub 说明中也提供了 ARM 使用方式，可作为回退
- 两者均非达梦官方公开镜像源，仅用于本地开发验证

## 3. 编排文件

验证环境编排文件：

- [docker-compose.multidb-lab.yml](/Users/xiaochen/Downloads/damoxing/docker-compose.multidb-lab.yml)

## 4. 已落地服务

### 4.1 PostgreSQL

容器名称：

- `damoxing-pg16`

端口映射：

- 宿主机 `55432` -> 容器 `5432`

连接信息：

- 数据库：`damoxing`
- 用户名：`damoxing`
- 密码：`Damoxing123!`

当前状态：

- 容器已启动
- 健康检查已通过
- `pg_isready` 已验证可连接

### 4.2 openGauss

容器名称：

- `damoxing-opengauss`

端口映射：

- 宿主机 `55433` -> 容器 `5432`

连接信息：
- 数据库：`postgres`
- 用户名：`gaussdb`
- 密码：`Damoxing123!`

当前状态：

- 容器已启动
- 容器内已监听 `5432`
- `select version();` 已验证可执行

### 4.3 Oracle Free

容器名称：

- `damoxing-oracle23`

端口规划：

- 宿主机 `51521` -> 容器 `1521`
- 宿主机 `55500` -> 容器 `5500`

连接信息：

- 系统密码：`Damoxing123!`
- 应用用户：`damoxing`
- 应用用户密码：`Damoxing123!`

当前状态：

- 编排已准备
- 容器已启动
- `select 1 from dual;` 已验证可执行

### 4.4 人大金仓

容器名称：

- `damoxing-kingbase`

端口映射：

- 宿主机 `55434` -> 容器 `54321`

卷映射：

- `kingbase_data` -> `/home/kingbase/userdata`
- `${KINGBASE_LICENSE_PATH:-/Users/xiaochen/Downloads/license_4_V009R001C-开发版-365天.dat}` -> `/home/kingbase/userdata/etc/license.dat`

连接信息：

- 用户名：`system`
- 密码：`Damoxing123!`
- 协议兼容模式：`pg`

当前状态：

- 容器已启动
- 端口映射已生效
- 编排已支持 `KINGBASE_IMAGE` 与 `KINGBASE_LICENSE_PATH` 覆盖

### 4.5 Dameng 8 ARM

容器名称：

- `damoxing-dm8`

端口映射：

- 宿主机 `5236` -> 容器 `5236`

卷映射：

- `dm8_data` -> `/home/dmdba/data`
- compose 已显式固定 `platform: linux/arm64`

镜像选择：

- 默认：`${DM8_IMAGE:-qinchz/dm8-arm64:latest}`
- 回退：启动前设置 `DM8_IMAGE=sizx/dm8`

连接约定：

- 地址：`127.0.0.1:5236`
- 本地验证账号：`SY_PTDX_CS`
- 本地验证密码：`SY_PTDX_CS`

当前状态：

- 编排已补充
- 容器已启动
- `docker port damoxing-dm8` 已验证映射到宿主机 `5236`
- `server/scripts/test_dm_ywbzk.js` 已验证可登录
- 存储过程链路已验证：`CHOSEN_SQL=select v_mxywblbzb from dual`、`OUT=[18]`、`RESULT=18`、`DETAIL=18.00`

## 5. 常用命令

启动全部环境：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d
```

单独启动 PostgreSQL：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d pg16
```

单独启动 openGauss：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d opengauss
```

单独启动 Oracle：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d oracle23
```

单独启动人大金仓：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d kingbase
```

单独启动达梦：

```bash
docker compose -f docker-compose.multidb-lab.yml up -d dm8
```

使用自定义 license 启动人大金仓：

```bash
KINGBASE_LICENSE_PATH=/path/to/license.dat docker compose -f docker-compose.multidb-lab.yml up -d kingbase
```

使用回退镜像启动达梦：

```bash
DM8_IMAGE=sizx/dm8 docker compose -f docker-compose.multidb-lab.yml up -d dm8
```

查看容器状态：

```bash
docker ps -a --format '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'
```

查看 PostgreSQL 端口：

```bash
docker port damoxing-pg16
```

查看 openGauss 端口：

```bash
docker port damoxing-opengauss
```

查看 openGauss 日志：

```bash
docker logs --tail 50 damoxing-opengauss
```

停止验证环境：

```bash
docker compose -f docker-compose.multidb-lab.yml down
```

停止并删除数据卷：

```bash
docker compose -f docker-compose.multidb-lab.yml down -v
```

## 6. 建议的验证顺序

建议先按以下顺序验证程序改造：

1. PostgreSQL
2. openGauss
3. 人大金仓
4. Oracle Free
5. Dameng 8 ARM

原因：

- PostgreSQL 起得最快，适合先打通 `pg` 链路
- openGauss 可验证高斯类数据库兼容性
- 人大金仓可补齐 `kingbase` 适配验证
- Oracle Free 可用于最终补充 `oracle` 侧联调
- 达梦镜像为第三方源，放在最后单独收口验证更稳妥

## 7. 后续扩展建议

如后续还要继续补本地验证库，建议优先级如下：

1. OceanBase
2. 人大金仓
4. DB2

说明：

- OceanBase 官方镜像公开可见，优先级较高
- 达梦已补充第三方 ARM 验证方案，但仍更建议结合现场实际镜像或内部镜像源
- 人大金仓更建议结合现场实际镜像或内部镜像源
- DB2 在当前 ARM 本机环境下不建议作为第一批验证目标
