@echo off
echo ====================================
echo 启动安全加固版服务器
echo ====================================
echo.

echo 检查 .env 文件...
if not exist .env (
    echo 首次运行，创建 .env 文件...
    copy .env.example .env
    echo.
    echo 已创建 .env 文件（使用默认配置）
    echo 生产环境请修改 SESSION_SECRET 和 NODE_ENV
    echo.
)

echo 检查数据库...
if not exist todos.db (
    echo 初始化数据库...
    call node init-db.js
    echo.
)

echo 正在启动安全加固版服务器（开发模式）...
echo 如需生产模式，请在 .env 中设置 NODE_ENV=production
echo.
call node server-secure.js
