# 📦 全平台私有化部署手册 (离线版)

本文档适用于**内网/离线环境**下的服务器部署。手册涵盖了从 Docker 环境的离线安装、镜像导入、项目启动到后期运维的全过程。

---

## 🏗️ 第一部分：Linux 服务器环境准备 (离线安装)

如果您的服务器无法访问外网，请按照以下步骤安装 Docker 环境。

### 1.1 获取离线安装包

在有网的机器上通过 Docker 官方下载页面获取对应架构 (x86_64/amd64 或 aarch64/arm64) 的二进制包。

*   **Docker CE 二进制包下载地址**: [https://download.docker.com/linux/static/stable/](https://download.docker.com/linux/static/stable/)
*   **Docker Compose 下载地址**: [https://github.com/docker/compose/releases](https://github.com/docker/compose/releases)

### 1.2 安装 Docker 引擎

假设您已将下载的 `docker-<version>.tgz` 包上传至服务器 `/tmp` 目录。

```bash
# 1. 解压安装包
tar -xvf /tmp/docker-*.tgz -C /tmp

# 2. 将二进制文件移入系统路径
sudo cp /tmp/docker/* /usr/bin/

# 3. 注册 Docker 为系统服务
# 创建 docker.service 文件
sudo cat > /etc/systemd/system/docker.service <<EOF
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target firewalld.service
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/bin/dockerd
ExecReload=/bin/kill -s HUP $MAINPID
LimitNOFILE=infinity
LimitNPROC=infinity
TimeoutStartSec=0
Delegate=yes
KillMode=process
Restart=on-failure
StartLimitBurst=3
StartLimitInterval=60s

[Install]
WantedBy=multi-user.target
EOF

# 4. 启动 Docker 并设置开机自启
sudo systemctl daemon-reload
sudo systemctl start docker
sudo systemctl enable docker

# 5. 验证安装
docker --version
```

### 1.3 安装 Docker Compose

```bash
# 1. 将下载的 docker-compose 文件重命名并移动
sudo mv docker-compose-linux-x86_64 /usr/local/bin/docker-compose

# 2. 赋予执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 3. 验证安装
docker-compose --version
```

---

## 🚀 第二部分：项目部署流程 (镜像包模式)

本部分说明如何使用离线镜像包 (`.tar`) 进行部署。

### 2.1 准备部署文件

请确保您拿到了交付的部署包，目录结构通常如下：

```text
deploy/
├── damoxing.tar           # 1. 项目离线镜像包
├── docker-compose.yml     # 2. 编排文件
├── .env.production        # 3. 配置文件模板
├── data/                  # 4. 数据目录
│   └── database.sqlite    #    (标准数据库文件)
└── logs/                  # 5. 日志目录
```

### 2.2 导入离线镜像

```bash
# 导入镜像
docker load -i damoxing.tar

# 验证镜像是否已加载
docker images | grep damoxing
```

### 2.3 配置参数

您有两种方式修改配置：

**方式一：使用 `.env` 文件 (推荐)**
复制模板文件并修改：

```bash
cp .env.production .env
vi .env
```

**关键配置项说明**：
*   `PORT`: 容器内部端口 (默认 3001)
*   `API_ROUTE_PREFIX`: 接口前缀 (默认 `/gjjrgzn/api`)
*   `JWT_SECRET`: 安全密钥 (请务必修改为随机字符串)
*   `CORS_ORIGIN`: 允许跨域的域名

**方式二：直接修改 `docker-compose.yml`**
如果您不想使用 `.env` 文件，可以直接在 `docker-compose.yml` 的 `environment` 部分硬编码：

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - API_ROUTE_PREFIX=/my-app/api  # 在此直接修改
      - JWT_SECRET=my-super-secret
```

### 2.4 启动服务

```bash
# 后台启动所有服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看启动日志
docker-compose logs -f
```

---

## 💾 第三部分：数据库运维

本项目使用 SQLite 数据库，标准交付包中包含了一个 `database.sqlite` 文件。

### 3.1 初始数据库部署

在首次部署时，直接将标准交付包中的 `data/database.sqlite` 放入部署目录的 `data/` 文件夹即可。Docker 容器启动时会自动挂载该文件。

**注意**：不需要执行任何初始化命令。

### 3.2 数据库更新 (SQL 升级)

当系统需要升级时，我们会提供 `.sql` 更新脚本。请按以下步骤操作：

```bash
# 1. 停止服务 (防止数据写入冲突)
docker-compose down

# 2. 备份当前数据库 (重要!)
cp data/database.sqlite data/database.sqlite.bak.$(date +%Y%m%d)

# 3. 执行 SQL 更新
# 需确保服务器上有 sqlite3 命令，如果没有，可使用临时容器执行
docker run --rm -v $(pwd)/data:/data keinos/sqlite3 sqlite3 /data/database.sqlite < update_v1.1.sql

# 4. 重启服务
docker-compose up -d
```

---

## 🛠️ 第四部分：配置中心使用指南

系统启动后，管理员可进入 **“系统管理 -> 配置中心”** 对系统功能进行动态配置。

### 4.1 路由管理 (Route Management)

**功能**：定义系统的顶层业务模块（如 `/system`）。

*   **新建路由**：
    *   **路由标识**：URL 路径的一部分，如 `risk_control` (只能是英文)。
    *   **组件类型**：
        *   `动态页面` (推荐)：使用系统的页面构建器，支持在线拖拽和配置。
        *   `静态组件`：开发人员编写的代码组件，需填写组件路径。
    *   **排序**：决定在导航栏中的显示顺序。

### 4.2 菜单管理 (Menu Management)

**功能**：配置左侧导航栏菜单树。

*   **添加菜单**：
    *   **菜单名称**：显示在界面的名称。
    *   **Page Key**：关联的页面ID，点击菜单后将渲染该页面。
    *   **所属路由**：选择该菜单属于哪个顶级模块（如 Dashboard 类还是 System 类）。
    *   **上级菜单**：支持多级菜单嵌套。
*   **权限关联**：(高级功能) 菜单可见性通常与角色权限绑定。

### 4.3 页面管理与 AI 集成

**功能**：管理具体的业务页面内容及 AI 工作流配置。

*   **页面配置**：
    *   点击 **“编辑配置”** 可打开可视化设计器。
    *   支持从模板库导入标准页面布局。
*   **AI 工作流集成 (Dify)**：
    *   点击 **"AI 工作流"** 按钮，为该页面绑定 Dify 能力。
    *   **工作流类型**：
        *   `AI 分析`：用于数据洞察页面。
        *   `报告生成`：用于一键生成 Word/PDF 报告。
        *   `数据导入`：智能解析上传的文件。
    *   **配置参数**：
        *   `API URL`: Dify 平台的 API 地址。
        *   `API Key`: 对应应用的 Secret Key。

---

**技术支持联系方式**
如遇部署问题，请联系系统运维团队或查阅项目 `logs/error.log` 获取详细错误信息。
