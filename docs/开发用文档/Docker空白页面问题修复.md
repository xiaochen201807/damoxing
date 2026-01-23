# Docker 空白页面问题修复

## 问题现象

- 容器启动后访问页面显示空白
- 浏览器开发者工具显示前端资源加载正常（200 状态）
- 但没有任何后端 API 调用（`/api` 请求）
- 容器健康检查失败（unhealthy）

![问题截图](/Users/xiaochen/.gemini/antigravity/brain/85003887-3111-436f-a2c4-746e907890f0/uploaded_image_1765931846816.png)

---

## 根本原因

### 环境变量配置错误

**问题文件**: `client/.env.production`

```env
# ❌ 错误配置
VITE_API_BASE_URL=https://api.yourdomain.com
```

**影响**:
1. 前端在生产环境构建时，将 API 基础地址硬编码为 `https://api.yourdomain.com`
2. 所有 API 请求都发往这个不存在的域名
3. Nginx 的反向代理配置（`/api` → `http://127.0.0.1:3001`）完全失效
4. 前端无法获取数据，页面显示空白

### 代码逻辑分析

**文件**: `client/src/utils/fetcher.ts`

```typescript
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ...

let requestUrl = url;
if (url.startsWith('/api')) {
  requestUrl = `${BASE_URL}${url}`;  // ❌ 拼接成 https://api.yourdomain.com/api/xxx
}
```

当 `VITE_API_BASE_URL=https://api.yourdomain.com` 时：
- 请求 `/api/menu` → 实际请求 `https://api.yourdomain.com/api/menu` ❌
- 应该请求 `/api/menu` → Nginx 代理到 `http://127.0.0.1:3001/api/menu` ✅

---

## 解决方案

### 修改 `.env.production`

```diff
# API 基础地址（请根据实际部署地址修改）
- VITE_API_BASE_URL=https://api.yourdomain.com
+ VITE_API_BASE_URL=
```

**说明**:
- 设置为空字符串，让前端使用相对路径
- Nginx 会将 `/api` 请求代理到容器内的 Node.js 后端（`http://127.0.0.1:3001`）
- 如果需要跨域访问（前端和后端分离部署），再填写完整域名

---

## 修复步骤

### 1. 更新环境变量

```bash
# 编辑文件
vim client/.env.production

# 修改为
VITE_API_BASE_URL=
```

### 2. 重新构建 Docker 镜像

```bash
# 停止并删除旧容器
docker-compose down

# 清理旧镜像（可选）
docker rmi damoxing-app

# 重新构建（不使用缓存）
docker-compose build --no-cache

# 启动容器
docker-compose up -d
```

### 3. 验证修复

```bash
# 查看容器状态（应该是 healthy）
docker ps

# 查看启动日志
docker logs -f damoxing-app

# 浏览器访问
# http://localhost
```

**预期结果**:
- ✅ 页面正常显示
- ✅ 浏览器开发者工具可以看到 `/api` 请求
- ✅ 容器健康检查通过（healthy）

---

## 其他部署场景

### 场景 1: 前后端同域部署（推荐）

**适用**: Docker 单容器部署（当前方案）

```env
# .env.production
VITE_API_BASE_URL=
```

**Nginx 配置**:
```nginx
location /api {
    proxy_pass http://127.0.0.1:3001;
}
```

### 场景 2: 前后端分离部署

**适用**: 前端部署在 CDN，后端独立服务器

```env
# .env.production
VITE_API_BASE_URL=https://api.example.com
```

**注意**: 需要配置后端 CORS

### 场景 3: 使用自定义域名

**适用**: 生产环境使用域名访问

```env
# .env.production
VITE_API_BASE_URL=https://yourdomain.com
```

**Nginx 配置**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location /api {
        proxy_pass http://127.0.0.1:3001;
    }
}
```

---

## 预防措施

### 1. 添加环境变量验证

在 `vite.config.ts` 中添加构建时检查：

```typescript
export default defineConfig({
  // ...
  define: {
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL || '')
  },
  build: {
    // 构建前检查
    rollupOptions: {
      plugins: [
        {
          name: 'validate-env',
          buildStart() {
            const apiUrl = process.env.VITE_API_BASE_URL;
            if (apiUrl && apiUrl.includes('yourdomain.com')) {
              this.warn('⚠️  检测到占位符域名，请修改 .env.production');
            }
          }
        }
      ]
    }
  }
});
```

### 2. 更新 `.env.example`

```env
# API 基础地址
# Docker 部署: 留空（使用相对路径）
# 分离部署: 填写后端完整地址（如 https://api.example.com）
VITE_API_BASE_URL=
```

### 3. 添加部署文档

在 `README.md` 中说明环境变量配置：

```markdown
## 环境变量配置

### Docker 部署
`.env.production` 中 `VITE_API_BASE_URL` 应设置为空字符串

### 独立部署
根据实际后端地址配置 `VITE_API_BASE_URL`
```

---

## 总结

### 问题根源
- ❌ 生产环境配置文件使用了占位符域名
- ❌ 前端请求发往错误的地址
- ❌ Nginx 反向代理未生效

### 解决方法
- ✅ 将 `VITE_API_BASE_URL` 设置为空字符串
- ✅ 重新构建 Docker 镜像
- ✅ 验证 API 请求正常

### 经验教训
1. **环境变量要根据部署方式配置**，不能使用占位符
2. **Docker 单容器部署应使用相对路径**，让 Nginx 代理
3. **构建前要检查环境变量**，避免将错误配置打包
4. **浏览器开发者工具是诊断利器**，可以快速定位问题
