# 快速开始：GitHub Actions 多架构构建

## 🚀 一键启用

### 1. 推送工作流文件

```bash
git add .github/workflows/docker-build.yml
git commit -m "ci: add GitHub Actions for multi-arch Docker build"
git push origin main
```

### 2. 配置仓库权限

1. 进入 GitHub 仓库 **Settings** → **Actions** → **General**
2. 在 **Workflow permissions** 中选择：
   - ✅ **Read and write permissions**
3. 保存

### 3. 触发构建

工作流会自动运行！查看进度：
- 进入仓库的 **Actions** 标签
- 查看 "Build and Push Multi-Arch Docker Image" 工作流

---

## 📦 使用构建的镜像

### 拉取镜像

```bash
# 替换 <username> 和 <repository> 为您的 GitHub 用户名和仓库名
docker pull ghcr.io/<username>/<repository>:latest
```

### 在 docker-compose.yml 中使用

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/<username>/<repository>:latest
    ports:
      - "80:80"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

### 部署

```bash
docker-compose pull
docker-compose up -d
```

---

## 🏷️ 镜像标签

| 推送操作 | 生成的标签 |
|---------|-----------|
| 推送到 main | `latest` |
| 推送标签 v1.2.3 | `v1.2.3`, `v1.2`, `v1`, `latest` |
| 推送到分支 dev | `dev` |

---

## 🎯 支持的架构

- ✅ **linux/amd64** - x86_64 (Intel/AMD)
- ✅ **linux/arm64** - ARM64 (Apple Silicon, ARM 服务器)

Docker 会自动选择适合您系统的架构！

---

## 📖 完整文档

详细配置和故障排查请查看：[GitHub Actions 多架构构建指南](./GitHub_Actions多架构构建指南.md)

---

## 🔧 可选：使用 Docker Hub

如果想推送到 Docker Hub：

1. 创建 Docker Hub 访问令牌
2. 在 GitHub 仓库添加 Secrets：
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`
3. 取消注释 `.github/workflows/docker-build.yml` 中的 Docker Hub 登录部分

---

## ✨ 特性

- 🔄 **自动化**：推送代码即自动构建
- 🌐 **多架构**：同时支持 x86 和 ARM
- 🏷️ **智能标签**：自动生成版本标签
- ⚡ **缓存优化**：加速后续构建
- 💰 **免费**：公开仓库完全免费
