# Docker 容器诊断指南

## 问题现象
- 容器状态: `unhealthy`
- 访问页面: 空白页面
- 容器 ID: `f26c9224f25f`
- 容器名称: `damoxing-app`

---

## 1. 进入容器的正确方法

### ❌ 错误命令
```bash
docker exec -it damoxing-app bash
# 错误: Alpine Linux 没有 bash
```

### ✅ 正确命令
```bash
# 使用 sh (Alpine Linux 默认 shell)
docker exec -it damoxing-app sh
```

---

## 2. 容器内诊断步骤

### 步骤 1: 检查进程状态
```bash
# 进入容器
docker exec -it damoxing-app sh

# 查看所有运行的进程
ps aux

# 应该看到:
# - supervisord (进程管理器)
# - nginx (Web 服务器)
# - node (后端服务)
```

### 步骤 2: 检查前端构建产物
```bash
# 检查前端文件是否存在
ls -la /usr/share/nginx/html/

# 应该包含:
# - index.html
# - assets/ (JS/CSS 文件)
# - 其他静态资源

# 查看 index.html 内容
cat /usr/share/nginx/html/index.html
```

### 步骤 3: 检查 Nginx 配置和状态
```bash
# 测试 Nginx 配置
nginx -t

# 查看 Nginx 错误日志
cat /var/log/nginx/error.log

# 查看 Nginx 访问日志
tail -f /var/log/nginx/access.log
```

### 步骤 4: 检查 Node.js 后端
```bash
# 检查后端是否在监听 3001 端口
netstat -tuln | grep 3001

# 或使用 (Alpine 可能需要安装)
ss -tuln | grep 3001

# 查看后端日志 (通过 supervisord)
cat /var/log/supervisord.log

# 测试健康检查端点
wget -O- http://127.0.0.1:3001/health
```

### 步骤 5: 检查数据库
```bash
# 检查数据库文件是否存在
ls -la /app/data/database.sqlite

# 检查数据库权限
ls -l /app/data/

# 尝试连接数据库
sqlite3 /app/data/database.sqlite ".tables"
```

---

## 3. 容器外诊断步骤

### 查看容器日志
```bash
# 查看所有日志
docker logs damoxing-app

# 实时查看日志
docker logs -f damoxing-app

# 查看最近 100 行
docker logs --tail 100 damoxing-app
```

### 检查健康检查状态
```bash
# 查看详细的健康检查信息
docker inspect damoxing-app | grep -A 20 Health
```

### 检查端口映射
```bash
# 确认端口映射正确
docker port damoxing-app
# 应该显示: 80/tcp -> 0.0.0.0:80
```

### 测试容器网络
```bash
# 从宿主机测试容器的 80 端口
curl -I http://localhost

# 测试健康检查端点
curl http://localhost/health
```

---

## 4. 常见问题和解决方案

### 问题 1: 前端构建产物缺失

**症状**: `/usr/share/nginx/html/` 目录为空或缺少文件

**原因**: 
- 前端构建失败
- Docker 构建时内存不足
- COPY 命令路径错误

**解决方案**:
```bash
# 重新构建镜像，查看构建日志
docker-compose build --no-cache

# 检查构建日志中的错误
# 特别关注 "frontend-builder" 阶段
```

### 问题 2: Node.js 后端未启动

**症状**: 3001 端口无响应，健康检查失败

**原因**:
- `index.js` 文件不存在
- 数据库连接失败
- 依赖包缺失

**解决方案**:
```bash
# 进入容器检查
docker exec -it damoxing-app sh

# 检查 index.js 是否存在
ls -la /app/index.js

# 手动启动后端查看错误
cd /app
node index.js

# 检查依赖
npm list --depth=0
```

### 问题 3: Nginx 配置错误

**症状**: Nginx 启动失败或 502 错误

**解决方案**:
```bash
# 进入容器
docker exec -it damoxing-app sh

# 测试配置
nginx -t

# 重启 Nginx
supervisorctl restart nginx
```

### 问题 4: 数据库权限问题

**症状**: 后端日志显示数据库访问错误

**解决方案**:
```bash
# 在宿主机上检查数据目录权限
ls -la ./data/

# 修复权限
chmod -R 755 ./data/
chown -R $(whoami) ./data/

# 重启容器
docker-compose restart
```

### 问题 5: 环境变量配置错误

**症状**: 后端无法连接数据库或 CORS 错误

**解决方案**:
```bash
# 检查容器环境变量
docker exec -it damoxing-app env | grep -E 'NODE_ENV|PORT|DB_PATH'

# 确认 docker-compose.yml 中的环境变量设置正确
```

---

## 5. 快速诊断命令集

在宿主机上运行以下命令进行快速诊断:

```bash
# 1. 查看容器状态
docker ps -a

# 2. 查看最近日志
docker logs --tail 50 damoxing-app

# 3. 进入容器
docker exec -it damoxing-app sh

# 4. 在容器内执行诊断
ps aux                                    # 检查进程
ls -la /usr/share/nginx/html/            # 检查前端文件
cat /usr/share/nginx/html/index.html     # 查看 HTML
nginx -t                                  # 测试 Nginx 配置
cat /var/log/nginx/error.log             # Nginx 错误日志
wget -O- http://127.0.0.1:3001/health    # 测试后端
ls -la /app/data/                        # 检查数据目录
supervisorctl status                      # 检查进程管理器状态
```

---

## 6. 重建容器的步骤

如果诊断后需要重建:

```bash
# 1. 停止并删除容器
docker-compose down

# 2. 清理旧镜像 (可选)
docker rmi damoxing-app

# 3. 重新构建 (不使用缓存)
docker-compose build --no-cache

# 4. 启动容器
docker-compose up -d

# 5. 查看启动日志
docker-compose logs -f
```

---

## 7. 调试模式运行

如果需要更详细的调试信息:

```bash
# 前台运行容器，查看实时日志
docker-compose up

# 或者单独运行容器
docker run -it --rm \
  -p 80:80 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e NODE_ENV=production \
  damoxing-app
```

---

## 8. 预期的正常状态

### 容器状态
```bash
$ docker ps
CONTAINER ID   IMAGE          STATUS
f26c9224f25f   damoxing-app   Up X minutes (healthy)
```

### 进程列表
```bash
$ docker exec -it damoxing-app ps aux
PID   USER     COMMAND
1     root     /usr/bin/supervisord
X     root     nginx: master process
X     root     node /app/index.js
```

### 健康检查
```bash
$ curl http://localhost/health
{"status":"ok"}
```

### 前端访问
```bash
$ curl -I http://localhost
HTTP/1.1 200 OK
Content-Type: text/html
```

---

## 下一步操作建议

1. **立即执行**: 运行快速诊断命令集（第 5 节）
2. **查看日志**: 重点关注容器启动时的错误信息
3. **检查文件**: 确认前端构建产物是否存在
4. **测试后端**: 验证 Node.js 服务是否正常运行
5. **如有问题**: 根据具体错误信息参考第 4 节的解决方案
