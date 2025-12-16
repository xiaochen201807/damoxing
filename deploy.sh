#!/bin/bash

# 大模型项目 - Docker 快速部署脚本

set -e  # 遇到错误立即退出

echo "🚀 大模型项目 - Docker 部署脚本"
echo "================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未安装 Docker Compose"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 创建必要的目录
echo "📁 创建数据目录..."
mkdir -p data logs backups
echo "✅ 目录创建完成"
echo ""

# 检查是否需要构建前端
if [ ! -d "client/dist" ]; then
    echo "📦 前端未构建,开始构建..."
    cd client
    
    if [ ! -d "node_modules" ]; then
        echo "📥 安装前端依赖..."
        npm install
    fi
    
    echo "🔨 构建前端..."
    npm run build
    cd ..
    echo "✅ 前端构建完成"
    echo ""
else
    echo "✅ 前端已构建,跳过"
    echo ""
fi

# 检查环境变量文件
if [ ! -f "server/.env" ]; then
    echo "⚙️  创建环境变量文件..."
    cp server/.env.example server/.env
    echo "⚠️  请编辑 server/.env 配置文件"
    echo ""
fi

# 检查数据库
if [ ! -f "data/database.sqlite" ]; then
    echo "🗄️  数据库不存在,需要初始化"
    echo "选择初始化方式:"
    echo "  1) 使用 Docker 容器初始化 (推荐)"
    echo "  2) 本地初始化 (需要 Node.js)"
    echo "  3) 跳过 (稍后手动初始化)"
    read -p "请选择 [1-3]: " choice
    
    case $choice in
        1)
            echo "🔨 构建 Docker 镜像..."
            docker-compose build
            echo "🗄️  初始化数据库..."
            docker-compose run --rm app npm run db:migrate
            echo "✅ 数据库初始化完成"
            ;;
        2)
            echo "🗄️  本地初始化数据库..."
            cd server
            if [ ! -d "node_modules" ]; then
                npm install
            fi
            npm run db:migrate
            cp database.sqlite ../data/
            cd ..
            echo "✅ 数据库初始化完成"
            ;;
        3)
            echo "⚠️  跳过数据库初始化"
            echo "请稍后运行: docker-compose run --rm app npm run db:migrate"
            ;;
        *)
            echo "❌ 无效选择,退出"
            exit 1
            ;;
    esac
    echo ""
fi

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build
echo "✅ 镜像构建完成"
echo ""

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d
echo "✅ 服务启动完成"
echo ""

# 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 5

# 健康检查
echo "🏥 健康检查..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ 服务健康检查通过"
else
    echo "⚠️  服务可能未完全启动,请稍后检查"
fi
echo ""

# 显示状态
echo "📊 服务状态:"
docker-compose ps
echo ""

# 完成
echo "================================"
echo "🎉 部署完成!"
echo ""
echo "访问地址:"
echo "  前端: http://localhost"
echo "  API:  http://localhost/api"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo "  进入容器: docker-compose exec app sh"
echo ""
echo "详细文档: DEPLOYMENT_SIMPLE.md"
echo "================================"
