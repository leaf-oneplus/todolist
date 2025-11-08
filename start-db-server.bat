@echo off
echo ====================================
echo 启动数据库版待办事项服务器
echo ====================================
echo.

echo 检查数据库是否已初始化...
if not exist todos.db (
    echo 首次运行，正在初始化数据库...
    call node init-db.js
    echo.
)

echo 正在启动服务器（无安全限制版本）...
echo 适合局域网内部使用
echo.
call node server-db.js
