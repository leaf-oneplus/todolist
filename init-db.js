// 数据库初始化脚本
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
    }
});

// 创建表
db.serialize(() => {
    // 用户表
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            manager_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (manager_id) REFERENCES users(id)
        )
    `);

    // 待办事项表
    db.run(`
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_by INTEGER NOT NULL,
            assigned_to INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
    `);

    // 创建默认用户
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    // 超级管理员
    db.run(`
        INSERT OR IGNORE INTO users (username, password, role, manager_id) 
        VALUES ('超级管理员', ?, 'super_admin', NULL)
    `, [defaultPassword]);

    // 部门管理员（上级是超级管理员）
    db.run(`
        INSERT OR IGNORE INTO users (username, password, role, manager_id) 
        VALUES ('部门经理', ?, 'admin', 1)
    `, [defaultPassword]);

    // 普通用户（上级是部门管理员）
    db.run(`
        INSERT OR IGNORE INTO users (username, password, role, manager_id) 
        VALUES ('员工A', ?, 'user', 2)
    `, [defaultPassword]);

    db.run(`
        INSERT OR IGNORE INTO users (username, password, role, manager_id) 
        VALUES ('员工B', ?, 'user', 2)
    `, [defaultPassword]);

    console.log(`
====================================
数据库初始化完成！
====================================

默认账号：
1. 超级管理员
   用户名: 超级管理员
   密码: admin123
   权限: 查看所有人的任务

2. 部门经理
   用户名: 部门经理
   密码: admin123
   权限: 查看下属（员工A、员工B）的任务

3. 员工A / 员工B
   用户名: 员工A 或 员工B
   密码: admin123
   权限: 只能查看自己的任务

====================================
    `);
});

db.close();
