# x86 快速构建工作流说明

## 概述

创建了独立的 x86 构建工作流，用于快速构建和测试，无需等待 ARM 架构。

---

## 两个工作流对比

### 1. `docker-build.yml` - 多架构构建（完整版）

**用途**: 正式发布，生产部署

**特点**:
- ✅ 支持 x86 + ARM 多架构
- ✅ 自动选择架构
- ⏱️ 构建时间: 6-10 分钟
- 🏷️ 标签: `latest`, `v1.0.0` 等

**触发条件**:
- 推送到 main/master
- 创建版本标签
- Pull Request

### 2. `docker-build-x86.yml` - x86 快速构建（新增）⚡

**用途**: 快速迭代，开发测试

**特点**:
- ✅ 仅构建 x86 架构
- ⚡ 构建时间: 3-5 分钟（快 50%）
- 🏷️ 标签: `x86`, `main-x86`, `v1.0.0-x86` 等

**触发条件**:
- 推送到 main/master/dev
- 创建版本标签
- Pull Request
- 手动触发

---

## 使用场景

### 场景 1: 开发测试（使用 x86 快速构建）

```bash
# 1. 推送代码到 dev 分支
git checkout -b dev
git push origin dev

# 2. 等待 3-5 分钟（仅构建 x86）

# 3. 拉取并测试
docker pull ghcr.io/<username>/<repository>:x86
docker run --rm ghcr.io/<username>/<repository>:x86
```

### 场景 2: 生产发布（使用多架构构建）

```bash
# 1. 合并到 main 并打标签
git checkout main
git merge dev
git tag v1.0.0
git push origin main --tags

# 2. 等待 6-10 分钟（构建 x86 + ARM）

# 3. 部署到生产
docker pull ghcr.io/<username>/<repository>:latest
docker-compose up -d
```

### 场景 3: 紧急修复（使用 x86 快速构建）

```bash
# 1. 修复 bug 并推送
git commit -m "fix: critical bug"
git push origin main

# 2. 手动触发 x86 构建
# GitHub → Actions → Build x86 Docker Image (Fast) → Run workflow

# 3. 快速验证（3-5 分钟）
docker pull ghcr.io/<username>/<repository>:x86
# 验证修复...

# 4. 确认后等待多架构构建完成
# 或手动触发多架构构建
```

---

## 镜像标签策略

### 多架构构建 (`docker-build.yml`)

| 触发 | 标签 | 示例 |
|------|------|------|
| 推送到 main | `latest` | `ghcr.io/user/repo:latest` |
| 标签 v1.0.0 | `v1.0.0`, `v1.0`, `v1` | `ghcr.io/user/repo:v1.0.0` |
| 分支 dev | `dev` | `ghcr.io/user/repo:dev` |

### x86 快速构建 (`docker-build-x86.yml`)

| 触发 | 标签 | 示例 |
|------|------|------|
| 推送到 main | `x86` | `ghcr.io/user/repo:x86` |
| 标签 v1.0.0 | `v1.0.0-x86` | `ghcr.io/user/repo:v1.0.0-x86` |
| 分支 dev | `dev-x86` | `ghcr.io/user/repo:dev-x86` |
| Commit SHA | `main-abc1234-x86` | `ghcr.io/user/repo:main-abc1234-x86` |

---

## 手动触发

### 触发 x86 快速构建

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Build x86 Docker Image (Fast)**
4. 点击 **Run workflow**
5. 选择分支
6. 点击 **Run workflow** 确认

### 触发多架构构建

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Build and Push Multi-Arch Docker Image**
4. 点击 **Run workflow**
5. 选择分支
6. 点击 **Run workflow** 确认

---

## 性能对比

| 指标 | 多架构构建 | x86 快速构建 | 差异 |
|------|-----------|-------------|------|
| **构建时间（首次）** | 8-12 分钟 | 4-6 分钟 | **快 50%** ⚡ |
| **构建时间（缓存）** | 4-6 分钟 | 2-3 分钟 | **快 50%** ⚡ |
| **支持架构** | x86 + ARM | 仅 x86 | - |
| **镜像大小** | 相同 | 相同 | - |
| **适用场景** | 生产部署 | 开发测试 | - |

---

## 工作流选择建议

### 使用 x86 快速构建 ⚡

- ✅ 开发和测试阶段
- ✅ 快速验证代码更改
- ✅ CI/CD 测试
- ✅ 紧急修复验证
- ✅ 只需要 x86 环境

### 使用多架构构建 🌐

- ✅ 生产环境部署
- ✅ 正式版本发布
- ✅ 需要支持 ARM 服务器
- ✅ 需要支持 Apple Silicon (M1/M2)
- ✅ 公开发布的镜像

---

## 示例工作流程

### 开发流程

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 开发并提交
git commit -m "feat: add new feature"

# 3. 推送到 dev 分支测试
git push origin dev

# 4. 等待 x86 快速构建（3-5 分钟）
# GitHub Actions 自动运行

# 5. 拉取并测试
docker pull ghcr.io/user/repo:dev-x86
docker run --rm ghcr.io/user/repo:dev-x86

# 6. 测试通过后合并到 main
git checkout main
git merge feature/new-feature
git push origin main

# 7. 等待多架构构建（6-10 分钟）
# 生成 latest 标签（支持所有架构）
```

### 发布流程

```bash
# 1. 确认 main 分支稳定
git checkout main
git pull

# 2. 创建版本标签
git tag v1.0.0
git push origin v1.0.0

# 3. 两个工作流都会触发
# - x86 快速构建: 生成 v1.0.0-x86 (3-5 分钟)
# - 多架构构建: 生成 v1.0.0 (6-10 分钟)

# 4. 使用多架构版本部署
docker pull ghcr.io/user/repo:v1.0.0
docker-compose up -d
```

---

## 缓存优化

两个工作流使用**独立的缓存**：

```yaml
# x86 快速构建
cache-from: type=gha,scope=build-x86
cache-to: type=gha,mode=max,scope=build-x86

# 多架构构建
cache-from: type=gha,scope=build-linux-amd64
cache-from: type=gha,scope=build-linux-arm64
```

**优势**：
- ✅ 互不干扰
- ✅ 缓存命中率更高
- ✅ 构建速度更快

---

## 成本分析

### GitHub Actions 免费额度

| 账户类型 | 分钟数/月 |
|---------|----------|
| Public 仓库 | 无限制 |
| Private (Free) | 2,000 |
| Private (Pro) | 3,000 |

### 实际消耗（每次推送）

**仅触发 x86 快速构建**：
- 1 个 job × 4 分钟 = 4 分钟

**同时触发两个工作流**：
- x86 快速: 4 分钟
- 多架构: 13 分钟（2×6 + 1）
- **总计**: 17 分钟

**建议**：
- 开发阶段推送到 `dev` 分支（仅触发 x86）
- 发布时推送到 `main` 或打标签（触发两个）

---

## 总结

### x86 快速构建的优势

- ⚡ **速度快**: 比多架构快 50%
- 🎯 **专注**: 只构建需要的架构
- 💰 **省资源**: 消耗更少的 Actions 分钟数
- 🔄 **快速迭代**: 适合开发测试

### 何时使用

| 场景 | 推荐工作流 |
|------|-----------|
| 日常开发 | x86 快速构建 ⚡ |
| 功能测试 | x86 快速构建 ⚡ |
| 紧急修复 | x86 快速构建 ⚡ |
| 正式发布 | 多架构构建 🌐 |
| 生产部署 | 多架构构建 🌐 |
| ARM 支持 | 多架构构建 🌐 |

**最佳实践**: 开发时使用 x86 快速构建，发布时使用多架构构建！
