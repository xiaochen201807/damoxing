# GitHub Actions 多架构 Docker 构建指南

## 概述

已为项目配置 GitHub Actions 自动化工作流，支持构建和发布多架构 Docker 镜像。

---

## 支持的架构

- ✅ **linux/amd64** - x86_64 架构（Intel/AMD 处理器）
- ✅ **linux/arm64** - ARM64 架构（Apple Silicon、ARM 服务器）

---

## 工作流触发条件

### 自动触发
1. **推送到主分支**
   ```bash
   git push origin main
   ```

2. **创建版本标签**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Pull Request**
   - 仅构建，不推送镜像

### 手动触发
在 GitHub 仓库页面：
1. 进入 **Actions** 标签
2. 选择 **Build and Push Multi-Arch Docker Image**
3. 点击 **Run workflow**

---

## 镜像标签策略

工作流会自动生成多个标签：

| 触发条件 | 生成的标签 | 示例 |
|---------|-----------|------|
| 推送到 main | `latest` | `ghcr.io/user/repo:latest` |
| 推送到分支 | `<branch>` | `ghcr.io/user/repo:dev` |
| 创建标签 v1.2.3 | `v1.2.3`, `v1.2`, `v1`, `latest` | `ghcr.io/user/repo:v1.2.3` |
| 提交 SHA | `<branch>-<sha>` | `ghcr.io/user/repo:main-abc1234` |

---

## 配置步骤

### 1. 启用 GitHub Container Registry

#### 方法 A: 使用 GitHub Container Registry (推荐)

**无需额外配置**，工作流会自动使用 `GITHUB_TOKEN`。

镜像地址格式：
```
ghcr.io/<username>/<repository>:tag
```

#### 方法 B: 使用 Docker Hub

1. **创建 Docker Hub 访问令牌**
   - 登录 [Docker Hub](https://hub.docker.com/)
   - Settings → Security → New Access Token
   - 复制生成的令牌

2. **添加 GitHub Secrets**
   - 进入仓库 Settings → Secrets and variables → Actions
   - 添加以下 secrets：
     - `DOCKERHUB_USERNAME`: Docker Hub 用户名
     - `DOCKERHUB_TOKEN`: 访问令牌

3. **修改工作流文件**
   ```yaml
   # 取消注释 .github/workflows/docker-build.yml 中的 Docker Hub 登录部分
   - name: Log in to Docker Hub
     if: github.event_name != 'pull_request'
     uses: docker/login-action@v3
     with:
       username: ${{ secrets.DOCKERHUB_USERNAME }}
       password: ${{ secrets.DOCKERHUB_TOKEN }}
   ```

### 2. 设置仓库权限

1. 进入仓库 **Settings** → **Actions** → **General**
2. 在 **Workflow permissions** 中选择：
   - ✅ **Read and write permissions**
3. 保存设置

### 3. 推送代码触发构建

```bash
git add .github/workflows/docker-build.yml
git commit -m "Add GitHub Actions for multi-arch Docker build"
git push origin main
```

---

## 使用构建的镜像

### 拉取镜像

```bash
# 从 GitHub Container Registry
docker pull ghcr.io/<username>/<repository>:latest

# 从 Docker Hub（如果配置了）
docker pull <username>/<repository>:latest
```

### 指定架构

```bash
# 拉取 amd64 架构
docker pull --platform linux/amd64 ghcr.io/<username>/<repository>:latest

# 拉取 arm64 架构
docker pull --platform linux/arm64 ghcr.io/<username>/<repository>:latest
```

### 在 docker-compose.yml 中使用

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/<username>/<repository>:latest
    # 或使用特定版本
    # image: ghcr.io/<username>/<repository>:v1.0.0
    ports:
      - "80:80"
    volumes:
      - ./data:/app/data
```

---

## 查看构建状态

### GitHub Actions 页面

1. 进入仓库的 **Actions** 标签
2. 查看工作流运行历史
3. 点击具体的运行查看详细日志

### 构建徽章

在 README.md 中添加构建状态徽章：

```markdown
![Docker Build](https://github.com/<username>/<repository>/actions/workflows/docker-build.yml/badge.svg)
```

---

## 高级配置

### 1. 添加更多架构

编辑 `.github/workflows/docker-build.yml`：

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3
  with:
    platforms: linux/amd64,linux/arm64,linux/arm/v7,linux/ppc64le
```

### 2. 自定义构建参数

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    build-args: |
      NODE_VERSION=18
      BUILD_DATE=${{ github.event.head_commit.timestamp }}
```

### 3. 构建多个镜像

```yaml
jobs:
  build-app:
    # ... 构建主应用
  
  build-nginx:
    # ... 构建 Nginx 镜像
```

### 4. 添加测试步骤

```yaml
- name: Test Docker image
  run: |
    docker run --rm ghcr.io/${{ github.repository }}:latest /app/test.sh
```

---

## 性能优化

### 1. 构建缓存

工作流已配置 GitHub Actions 缓存：

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**效果**：
- 首次构建：约 10-15 分钟
- 后续构建：约 2-5 分钟（利用缓存）

### 2. 并行构建

如果有多个独立的镜像，可以并行构建：

```yaml
strategy:
  matrix:
    image: [app, nginx, worker]
```

---

## 故障排查

### 问题 1: 权限错误

```
Error: buildx failed with: ERROR: failed to solve: failed to push
```

**解决方案**：
1. 检查仓库 Settings → Actions → Workflow permissions
2. 确保选择了 "Read and write permissions"

### 问题 2: 镜像推送失败

```
Error: denied: permission_denied
```

**解决方案**：
1. 确认 secrets 配置正确
2. 检查 Docker Hub 令牌是否有效
3. 验证用户名是否正确

### 问题 3: 构建超时

```
Error: The job running on runner has exceeded the maximum execution time
```

**解决方案**：
1. 优化 Dockerfile（减少层数）
2. 使用 `.dockerignore` 排除不必要的文件
3. 启用构建缓存

### 问题 4: 架构不支持

```
Error: no match for platform in manifest
```

**解决方案**：
1. 确认 QEMU 正确设置
2. 检查基础镜像是否支持目标架构
3. 验证 Dockerfile 中的依赖是否支持多架构

---

## 本地测试多架构构建

在推送到 GitHub 之前，可以本地测试：

```bash
# 1. 创建 buildx 构建器
docker buildx create --name multiarch --use

# 2. 启动构建器
docker buildx inspect --bootstrap

# 3. 构建多架构镜像（不推送）
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t damoxing-app:test \
  .

# 4. 构建并加载到本地（仅单架构）
docker buildx build \
  --platform linux/amd64 \
  -t damoxing-app:test \
  --load \
  .
```

---

## 安全最佳实践

### 1. 使用 Secrets

**永远不要**在代码中硬编码敏感信息：

```yaml
# ❌ 错误
password: mypassword123

# ✅ 正确
password: ${{ secrets.MY_PASSWORD }}
```

### 2. 最小权限原则

只授予工作流必需的权限：

```yaml
permissions:
  contents: read
  packages: write
```

### 3. 镜像扫描

添加安全扫描步骤：

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository }}:latest
    format: 'sarif'
    output: 'trivy-results.sarif'
```

---

## 成本优化

### GitHub Actions 免费额度

| 账户类型 | 免费分钟数/月 | 存储空间 |
|---------|--------------|---------|
| Public 仓库 | 无限制 | 500 MB |
| Private 仓库（Free） | 2,000 分钟 | 500 MB |
| Private 仓库（Pro） | 3,000 分钟 | 2 GB |

### 优化建议

1. **使用缓存**：减少构建时间
2. **条件触发**：避免不必要的构建
3. **清理旧镜像**：定期删除未使用的镜像

---

## 示例：完整的发布流程

```bash
# 1. 开发完成，提交代码
git add .
git commit -m "feat: add new feature"
git push origin main

# 2. 创建版本标签
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions 自动构建并推送镜像
# ghcr.io/user/repo:v1.0.0
# ghcr.io/user/repo:v1.0
# ghcr.io/user/repo:v1
# ghcr.io/user/repo:latest

# 4. 在服务器上部署
docker pull ghcr.io/user/repo:v1.0.0
docker-compose up -d
```

---

## 总结

### 优势

- ✅ **自动化**：推送代码即自动构建
- ✅ **多架构**：同时支持 x86 和 ARM
- ✅ **版本管理**：自动生成多个标签
- ✅ **缓存优化**：加速后续构建
- ✅ **免费**：公开仓库完全免费

### 下一步

1. 推送工作流文件到 GitHub
2. 配置仓库权限
3. 触发首次构建
4. 验证镜像可用性
5. 更新部署文档

---

## 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
