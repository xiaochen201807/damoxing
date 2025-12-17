#!/bin/bash
# 在 Windows Git Bash 中禁用路径转换，防止 /usr/share 被转换为 C:/Program Files/...
export MSYS_NO_PATHCONV=1

# 大模型项目快速诊断脚本

echo "========================================="
echo "🔍 大模型项目诊断脚本"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "1️⃣  容器状态检查"
echo "---"
if docker ps | grep -q damoxing-app; then
    echo -e "${GREEN}✅ 容器正在运行${NC}"
    docker ps | grep damoxing
else
    echo -e "${RED}❌ 容器未运行${NC}"
    docker ps -a | grep damoxing
    exit 1
fi

echo ""
echo "2️⃣  健康检查状态"
echo "---"
HEALTH=$(docker inspect damoxing-app --format='{{.State.Health.Status}}' 2>/dev/null)
if [ "$HEALTH" = "healthy" ]; then
    echo -e "${GREEN}✅ 健康检查通过: $HEALTH${NC}"
else
    echo -e "${YELLOW}⚠️  健康检查状态: $HEALTH${NC}"
fi

echo ""
echo "3️⃣  前端文件检查"
echo "---"
FILE_COUNT=$(docker exec damoxing-app sh -c 'ls /usr/share/nginx/html/ 2>/dev/null | wc -l')
if [ "$FILE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ 前端文件存在 ($FILE_COUNT 个文件/目录)${NC}"
    docker exec damoxing-app ls -lh /usr/share/nginx/html/ | head -5
else
    echo -e "${RED}❌ 前端文件缺失${NC}"
fi

echo ""
echo "4️⃣  进程检查"
echo "---"
docker exec damoxing-app ps aux | grep -E "PID|nginx|node|supervisord" | grep -v grep

echo ""
echo "5️⃣  端口监听检查"
echo "---"
docker exec damoxing-app sh -c 'netstat -tuln 2>/dev/null || ss -tuln' | grep -E "80|3001"

echo ""
echo "6️⃣  数据库文件检查"
echo "---"
if docker exec damoxing-app test -f /app/data/database.sqlite; then
    DB_SIZE=$(docker exec damoxing-app du -h /app/data/database.sqlite | cut -f1)
    echo -e "${GREEN}✅ 数据库文件存在: $DB_SIZE${NC}"
    docker exec damoxing-app ls -lh /app/data/
else
    echo -e "${RED}❌ 数据库文件不存在${NC}"
fi

echo ""
echo "7️⃣  Nginx 错误日志"
echo "---"
ERROR_COUNT=$(docker exec damoxing-app sh -c 'cat /var/log/nginx/error.log 2>/dev/null | wc -l')
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ 无 Nginx 错误${NC}"
else
    echo -e "${YELLOW}⚠️  发现 $ERROR_COUNT 行错误日志:${NC}"
    docker exec damoxing-app tail -5 /var/log/nginx/error.log
fi

echo ""
echo "8️⃣  健康检查端点测试"
echo "---"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ 健康检查端点正常: HTTP $HEALTH_RESPONSE${NC}"
    curl -s http://localhost/health
else
    echo -e "${RED}❌ 健康检查端点异常: HTTP $HEALTH_RESPONSE${NC}"
fi

echo ""
echo "9️⃣  菜单 API 测试"
echo "---"
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/system/menu 2>/dev/null)
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ 菜单 API 正常: HTTP $API_RESPONSE${NC}"
    curl -s http://localhost/api/system/menu | head -c 200
    echo "..."
else
    echo -e "${RED}❌ 菜单 API 异常: HTTP $API_RESPONSE${NC}"
fi

echo ""
echo "🔟 数据库表检查"
echo "---"
TABLES=$(docker exec damoxing-app sqlite3 /app/data/database.sqlite ".tables" 2>/dev/null)
if [ -n "$TABLES" ]; then
    echo -e "${GREEN}✅ 数据库表:${NC}"
    echo "$TABLES"
else
    echo -e "${RED}❌ 无法读取数据库表${NC}"
fi

echo ""
echo "========================================="
echo "📊 诊断总结"
echo "========================================="

# 综合判断
ISSUES=0

if [ "$HEALTH" != "healthy" ]; then
    echo -e "${YELLOW}⚠️  容器健康检查未通过${NC}"
    ((ISSUES++))
fi

if [ "$FILE_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ 前端文件缺失 - 这可能是空白页面的原因${NC}"
    ((ISSUES++))
fi

if [ "$HEALTH_RESPONSE" != "200" ]; then
    echo -e "${YELLOW}⚠️  健康检查端点异常${NC}"
    ((ISSUES++))
fi

if [ "$API_RESPONSE" != "200" ]; then
    echo -e "${YELLOW}⚠️  API 端点异常${NC}"
    ((ISSUES++))
fi

if [ -z "$TABLES" ]; then
    echo -e "${YELLOW}⚠️  数据库可能未正确初始化${NC}"
    ((ISSUES++))
fi

echo ""
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo "如果页面仍然空白，请检查浏览器开发者工具 (F12):"
    echo "  - Network 标签: 查看资源加载情况"
    echo "  - Console 标签: 查看 JavaScript 错误"
else
    echo -e "${RED}发现 $ISSUES 个问题，请根据上述信息进行修复${NC}"
fi

echo ""
echo "========================================="
