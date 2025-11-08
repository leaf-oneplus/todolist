// 基于数据库的服务器
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// 数据库连接
const db = new sqlite3.Database('./todos.db');

// 中间件
app.use(express.json());
app.use(express.static(__dirname));

// Session 必须在 CORS 之前配置
app.use(session({
    secret: 'todo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        sameSite: false, // 改为 false 以支持远程访问（局域网环境）
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// CORS 配置
app.use(cors({
    origin: true,
    credentials: true
}));

// 权限检查中间件
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: '未登录' });
    }
    next();
}

// 获取用户信息
function getUserInfo(userId, callback) {
    db.get('SELECT id, username, login_name, role, manager_id FROM users WHERE id = ?', [userId], callback);
}

// 获取用户的下属ID列表（递归，支持多上级）
function getSubordinates(userId, callback) {
    const subordinates = new Set(); // 使用Set避免重复
    
    function findSubordinates(managerId) {
        return new Promise((resolve) => {
            // 同时查询两个来源：users.manager_id 和 user_managers 表
            Promise.all([
                // 查询 users 表中的直接下属
                new Promise((res) => {
                    db.all('SELECT id FROM users WHERE manager_id = ?', [managerId], (err, rows) => {
                        res(err ? [] : rows);
                    });
                }),
                // 查询 user_managers 表中的下属
                new Promise((res) => {
                    db.all('SELECT user_id as id FROM user_managers WHERE manager_id = ?', [managerId], (err, rows) => {
                        res(err ? [] : rows);
                    });
                })
            ]).then(([directSubs, multiSubs]) => {
                // 合并两个来源的下属
                const allSubs = [...directSubs, ...multiSubs];
                
                if (allSubs.length === 0) {
                    return resolve();
                }
                
                // 递归查询所有下属的下属
                const promises = allSubs.map(row => {
                    if (!subordinates.has(row.id)) {
                        subordinates.add(row.id);
                        return findSubordinates(row.id);
                    }
                    return Promise.resolve();
                });
                
                Promise.all(promises).then(resolve);
            });
        });
    }
    
    findSubordinates(userId).then(() => {
        callback(null, Array.from(subordinates));
    });
}

// API 路由

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // 使用 login_name 进行登录，如果没有则使用 username（兼容旧数据）
    db.get('SELECT * FROM users WHERE login_name = ? OR (login_name IS NULL AND username = ?)', [username, username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '服务器错误' });
        }
        
        if (!user) {
            return res.status(401).json({ error: '登录名或密码错误' });
        }
        
        bcrypt.compare(password, user.password, (err, match) => {
            if (match) {
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.role = user.role;
                
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        login_name: user.login_name,
                        role: user.role
                    }
                });
            } else {
                res.status(401).json({ error: '登录名或密码错误' });
            }
        });
    });
});

// 登出
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 获取当前用户信息
app.get('/api/current-user', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(user);
    });
});

// 格式化待办事项数据
function formatTodo(todo) {
    return {
        id: todo.id,
        text: todo.text,
        completed: todo.completed === 1,
        createdBy: todo.created_by_name || '未知',
        assignedTo: todo.assigned_to_name || null,
        createdAt: todo.created_at,
        completedAt: todo.completed_at || null
    };
}

// 获取待办事项（根据权限）
app.get('/api/todos', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.role === 'super_admin') {
            // 超级管理员：查看所有任务
            db.all(`
                SELECT t.*, 
                       u1.username as created_by_name,
                       u2.username as assigned_to_name
                FROM todos t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
                ORDER BY t.id DESC
            `, (err, todos) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                const formattedTodos = todos.map(formatTodo);
                res.json({ todosWork1: formattedTodos, todosWork2: [] });
            });
        } else if (user.role === 'admin') {
            // 部门管理员：查看自己和下属的任务
            getSubordinates(user.id, (err, subordinates) => {
                const userIds = [user.id, ...subordinates];
                const placeholders = userIds.map(() => '?').join(',');
                
                db.all(`
                    SELECT t.*, 
                           u1.username as created_by_name,
                           u2.username as assigned_to_name
                    FROM todos t
                    LEFT JOIN users u1 ON t.created_by = u1.id
                    LEFT JOIN users u2 ON t.assigned_to = u2.id
                    WHERE t.created_by IN (${placeholders}) 
                       OR t.assigned_to IN (${placeholders})
                    ORDER BY t.id DESC
                `, [...userIds, ...userIds], (err, todos) => {
                    if (err) {
                        return res.status(500).json({ error: '查询失败' });
                    }
                    const formattedTodos = todos.map(formatTodo);
                    res.json({ todosWork1: formattedTodos, todosWork2: [] });
                });
            });
        } else {
            // 普通用户：只查看自己的任务
            db.all(`
                SELECT t.*, 
                       u1.username as created_by_name,
                       u2.username as assigned_to_name
                FROM todos t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
                WHERE t.created_by = ? OR t.assigned_to = ?
                ORDER BY t.id DESC
            `, [user.id, user.id], (err, todos) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                const formattedTodos = todos.map(formatTodo);
                res.json({ todosWork1: formattedTodos, todosWork2: [] });
            });
        }
    });
});

// 创建待办事项
app.post('/api/todos', requireAuth, (req, res) => {
    const { text, assignedTo } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: '任务内容不能为空' });
    }
    
    // 查找分配对象的用户ID
    if (assignedTo) {
        db.get('SELECT id FROM users WHERE username = ?', [assignedTo], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: '用户不存在' });
            }
            
            db.run(`
                INSERT INTO todos (text, created_by, assigned_to, created_at)
                VALUES (?, ?, ?, datetime('now', 'localtime'))
            `, [text, req.session.userId, user.id], function(err) {
                if (err) {
                    console.error('创建失败:', err);
                    return res.status(500).json({ error: '创建失败' });
                }
                res.json({ success: true, id: this.lastID });
            });
        });
    } else {
        db.run(`
            INSERT INTO todos (text, created_by, created_at)
            VALUES (?, ?, datetime('now', 'localtime'))
        `, [text, req.session.userId], function(err) {
            if (err) {
                console.error('创建失败:', err);
                return res.status(500).json({ error: '创建失败' });
            }
            res.json({ success: true, id: this.lastID });
        });
    }
});

// 更新待办事项
app.put('/api/todos/:id', requireAuth, (req, res) => {
    const { completed } = req.body;
    const todoId = req.params.id;
    
    if (completed) {
        db.run(`
            UPDATE todos 
            SET completed = 1, completed_at = datetime('now', 'localtime')
            WHERE id = ?
        `, [todoId], (err) => {
            if (err) {
                console.error('更新失败:', err);
                return res.status(500).json({ error: '更新失败' });
            }
            res.json({ success: true });
        });
    } else {
        db.run(`
            UPDATE todos 
            SET completed = 0, completed_at = NULL
            WHERE id = ?
        `, [todoId], (err) => {
            if (err) {
                console.error('更新失败:', err);
                return res.status(500).json({ error: '更新失败' });
            }
            res.json({ success: true });
        });
    }
});

// 删除待办事项
app.delete('/api/todos/:id', requireAuth, (req, res) => {
    const todoId = req.params.id;
    
    db.run('DELETE FROM todos WHERE id = ?', [todoId], (err) => {
        if (err) {
            return res.status(500).json({ error: '删除失败' });
        }
        res.json({ success: true });
    });
});

// 重新分配任务
app.put('/api/todos/:id/reassign', requireAuth, (req, res) => {
    const todoId = req.params.id;
    const { assignedTo } = req.body;
    
    if (!assignedTo) {
        return res.status(400).json({ error: '请指定分配对象' });
    }
    
    // 查找用户
    db.get('SELECT id FROM users WHERE username = ?', [assignedTo], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        db.run('UPDATE todos SET assigned_to = ? WHERE id = ?', [user.id, todoId], (err) => {
            if (err) {
                return res.status(500).json({ error: '分配失败' });
            }
            res.json({ success: true });
        });
    });
});

// 获取所有用户（完整信息，仅管理员）
app.get('/api/users/all', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 只有管理员可以查看所有用户
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        let query = `
            SELECT u.id, u.username, u.login_name, u.role, u.created_at, u.manager_id,
                   m.username as manager_name
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
        `;
        
        // 部门管理员不能查看超级管理员
        if (user.role === 'admin') {
            query += ` WHERE u.role != 'super_admin'`;
        }
        
        query += ` ORDER BY u.id`;
        
        db.all(query, (err, users) => {
            if (err) {
                console.error('查询失败:', err);
                return res.status(500).json({ error: '查询失败' });
            }
            
            // 获取每个用户的所有上级
            const userIds = users.map(u => u.id);
            if (userIds.length === 0) {
                return res.json([]);
            }
            
            const placeholders = userIds.map(() => '?').join(',');
            db.all(`
                SELECT um.user_id, um.manager_id, u.username as manager_name
                FROM user_managers um
                LEFT JOIN users u ON um.manager_id = u.id
                WHERE um.user_id IN (${placeholders})
            `, userIds, (err, managers) => {
                if (err) {
                    console.error('查询上级失败:', err);
                    return res.json(users); // 即使查询失败也返回基本信息
                }
                
                // 将上级信息附加到用户对象
                const usersWithManagers = users.map(u => {
                    const userManagers = managers
                        .filter(m => m.user_id === u.id)
                        .map(m => ({
                            id: m.manager_id,
                            name: m.manager_name
                        }));
                    
                    return {
                        ...u,
                        managers: userManagers,
                        manager_names: userManagers.map(m => m.name).join(', ') || null
                    };
                });
                
                res.json(usersWithManagers);
            });
        });
    });
});

// 获取管理员列表
app.get('/api/users/managers', requireAuth, (req, res) => {
    db.all(`
        SELECT id, username, role 
        FROM users 
        WHERE role IN ('super_admin', 'admin')
        ORDER BY username
    `, (err, users) => {
        if (err) {
            console.error('查询失败:', err);
            return res.status(500).json({ error: '查询失败' });
        }
        res.json(users);
    });
});

// 获取用户的所有上级
app.get('/api/users/:id/managers', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: '无效的用户ID' });
    }
    
    db.all(`
        SELECT um.manager_id as id, u.username, u.role
        FROM user_managers um
        LEFT JOIN users u ON um.manager_id = u.id
        WHERE um.user_id = ?
        ORDER BY u.username
    `, [userId], (err, managers) => {
        if (err) {
            console.error('查询失败:', err);
            return res.status(500).json({ error: '查询失败' });
        }
        res.json(managers);
    });
});

// 添加上级
app.post('/api/users/:id/managers', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const userId = parseInt(req.params.id);
        const { managerId } = req.body;
        
        if (isNaN(userId) || !managerId) {
            return res.status(400).json({ error: '参数错误' });
        }
        
        // 检查是否会造成循环引用
        checkCircularReference(userId, managerId, (hasCircular) => {
            if (hasCircular) {
                return res.status(400).json({ error: '不能添加：会造成循环引用' });
            }
            
            db.run(`
                INSERT OR IGNORE INTO user_managers (user_id, manager_id)
                VALUES (?, ?)
            `, [userId, managerId], function(err) {
                if (err) {
                    console.error('添加失败:', err);
                    return res.status(500).json({ error: '添加失败' });
                }
                
                if (this.changes === 0) {
                    return res.status(400).json({ error: '该上级已存在' });
                }
                
                res.json({ success: true });
            });
        });
    });
});

// 删除上级
app.delete('/api/users/:id/managers/:managerId', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const userId = parseInt(req.params.id);
        const managerId = parseInt(req.params.managerId);
        
        if (isNaN(userId) || isNaN(managerId)) {
            return res.status(400).json({ error: '参数错误' });
        }
        
        db.run(`
            DELETE FROM user_managers
            WHERE user_id = ? AND manager_id = ?
        `, [userId, managerId], function(err) {
            if (err) {
                console.error('删除失败:', err);
                return res.status(500).json({ error: '删除失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '关系不存在' });
            }
            
            res.json({ success: true });
        });
    });
});

// 检查循环引用
function checkCircularReference(userId, managerId, callback) {
    // 如果要添加的上级就是自己，直接返回true
    if (userId === managerId) {
        return callback(true);
    }
    
    // 检查managerId是否在userId的下属链中
    function checkSubordinates(currentId, targetId, visited = new Set()) {
        if (visited.has(currentId)) {
            return Promise.resolve(false);
        }
        visited.add(currentId);
        
        return new Promise((resolve) => {
            db.all(`
                SELECT user_id FROM user_managers WHERE manager_id = ?
            `, [currentId], (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return resolve(false);
                }
                
                // 如果找到目标，说明有循环
                if (rows.some(r => r.user_id === targetId)) {
                    return resolve(true);
                }
                
                // 递归检查所有下属
                Promise.all(
                    rows.map(r => checkSubordinates(r.user_id, targetId, visited))
                ).then(results => {
                    resolve(results.some(r => r === true));
                });
            });
        });
    }
    
    checkSubordinates(userId, managerId).then(hasCircular => {
        callback(hasCircular);
    });
}

// 创建新用户
app.post('/api/users', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 只有管理员可以创建用户
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const { username, login_name, password, role, managerId } = req.body;
        
        if (!username || !login_name || !password || !role) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少需要6位' });
        }
        
        // 部门管理员不能创建超级管理员
        if (user.role === 'admin' && role === 'super_admin') {
            return res.status(403).json({ error: '部门管理员不能创建超级管理员' });
        }
        
        // 加密密码
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error('密码加密失败:', err);
                return res.status(500).json({ error: '创建失败' });
            }
            
            db.run(`
                INSERT INTO users (username, login_name, password, role, manager_id, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
            `, [username, login_name, hashedPassword, role, managerId || null], function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: '登录名已存在' });
                    }
                    console.error('创建失败:', err);
                    return res.status(500).json({ error: '创建失败' });
                }
                res.json({ success: true, id: this.lastID });
            });
        });
    });
});

// 更新用户信息
app.put('/api/users/:id', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 只有管理员可以更新用户
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const userId = req.params.id;
        const { username, role, managerId } = req.body;
        
        if (!role) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        
        // 如果提供了用户名，验证不为空
        if (username !== undefined && !username.trim()) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        
        // 部门管理员不能修改超级管理员，也不能将用户提升为超级管理员
        if (user.role === 'admin') {
            // 检查目标用户是否是超级管理员
            db.get('SELECT role FROM users WHERE id = ?', [userId], (err, targetUser) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                
                if (!targetUser) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                if (targetUser.role === 'super_admin') {
                    return res.status(403).json({ error: '部门管理员不能修改超级管理员' });
                }
                
                if (role === 'super_admin') {
                    return res.status(403).json({ error: '部门管理员不能将用户提升为超级管理员' });
                }
                
                // 执行更新
                updateUser();
            });
        } else {
            // 超级管理员可以修改任何人
            updateUser();
        }
        
        function updateUser() {
            // 构建更新语句
            let updateFields = ['role = ?'];
            let updateValues = [role];
            
            if (username !== undefined) {
                updateFields.push('username = ?');
                updateValues.push(username.trim());
            }
            
            if (managerId !== undefined) {
                updateFields.push('manager_id = ?');
                updateValues.push(managerId || null);
            }
            
            updateValues.push(userId);
            
            db.run(`
                UPDATE users 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, updateValues, function(err) {
                if (err) {
                    console.error('更新失败:', err);
                    return res.status(500).json({ error: '更新失败' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                res.json({ success: true });
            });
        }
    });
});

// 修改自己的密码
app.put('/api/change-password', requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: '新密码至少需要6位' });
    }
    
    const userId = req.session.userId;
    
    // 获取用户当前密码
    db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 验证旧密码
        bcrypt.compare(oldPassword, user.password, (err, match) => {
            if (err) {
                console.error('密码验证失败:', err);
                return res.status(500).json({ error: '验证失败' });
            }
            
            if (!match) {
                return res.status(401).json({ error: '旧密码错误' });
            }
            
            // 加密新密码
            bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                if (err) {
                    console.error('密码加密失败:', err);
                    return res.status(500).json({ error: '修改失败' });
                }
                
                // 更新密码
                db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function(err) {
                    if (err) {
                        console.error('更新密码失败:', err);
                        return res.status(500).json({ error: '修改失败' });
                    }
                    
                    res.json({ success: true, message: '密码修改成功' });
                });
            });
        });
    });
});

// 重置用户密码（管理员功能）
app.put('/api/users/:id/password', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 只有管理员可以重置密码
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const userId = req.params.id;
        const { password } = req.body;
        
        if (!password || password.length < 6) {
            return res.status(400).json({ error: '密码至少需要6位' });
        }
        
        // 部门管理员不能重置超级管理员的密码
        if (user.role === 'admin') {
            db.get('SELECT role FROM users WHERE id = ?', [userId], (err, targetUser) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                
                if (!targetUser) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                if (targetUser.role === 'super_admin') {
                    return res.status(403).json({ error: '部门管理员不能重置超级管理员的密码' });
                }
                
                resetPassword();
            });
        } else {
            resetPassword();
        }
        
        function resetPassword() {
            // 加密密码
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) {
                    console.error('密码加密失败:', err);
                    return res.status(500).json({ error: '重置失败' });
                }
                
                db.run(`
                    UPDATE users 
                    SET password = ?
                    WHERE id = ?
                `, [hashedPassword, userId], function(err) {
                    if (err) {
                        console.error('重置失败:', err);
                        return res.status(500).json({ error: '重置失败' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: '用户不存在' });
                    }
                    
                    res.json({ success: true });
                });
            });
        }
    });
});

// 删除用户
app.delete('/api/users/:id', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 只有管理员可以删除用户
        if (user.role !== 'super_admin' && user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const userId = req.params.id;
        
        // 不能删除自己
        if (parseInt(userId) === user.id) {
            return res.status(400).json({ error: '不能删除自己' });
        }
        
        // 部门管理员不能删除超级管理员
        if (user.role === 'admin') {
            db.get('SELECT role FROM users WHERE id = ?', [userId], (err, targetUser) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                
                if (!targetUser) {
                    return res.status(404).json({ error: '用户不存在' });
                }
                
                if (targetUser.role === 'super_admin') {
                    return res.status(403).json({ error: '部门管理员不能删除超级管理员' });
                }
                
                checkAndDelete();
            });
        } else {
            checkAndDelete();
        }
        
        function checkAndDelete() {
            // 检查是否有下属
            db.get('SELECT COUNT(*) as count FROM users WHERE manager_id = ?', [userId], (err, result) => {
                if (err) {
                    console.error('查询失败:', err);
                    return res.status(500).json({ error: '删除失败' });
                }
                
                if (result.count > 0) {
                    return res.status(400).json({ error: '该用户还有下属，请先转移或删除下属' });
                }
                
                // 删除用户的待办事项
                db.run('DELETE FROM todos WHERE created_by = ? OR assigned_to = ?', [userId, userId], (err) => {
                    if (err) {
                        console.error('删除待办事项失败:', err);
                    }
                    
                    // 删除用户
                    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                        if (err) {
                            console.error('删除失败:', err);
                            return res.status(500).json({ error: '删除失败' });
                        }
                        
                        if (this.changes === 0) {
                            return res.status(404).json({ error: '用户不存在' });
                        }
                        
                        res.json({ success: true });
                    });
                });
            });
        }
    });
});

// 获取所有用户（用于分配任务）
app.get('/api/users', requireAuth, (req, res) => {
    getUserInfo(req.session.userId, (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.role === 'super_admin') {
            // 超级管理员可以看到所有用户
            db.all('SELECT id, username, role FROM users', (err, users) => {
                if (err) {
                    return res.status(500).json({ error: '查询失败' });
                }
                res.json(users);
            });
        } else if (user.role === 'admin') {
            // 部门管理员只能看到下属
            getSubordinates(user.id, (err, subordinates) => {
                const userIds = [user.id, ...subordinates];
                const placeholders = userIds.map(() => '?').join(',');
                
                db.all(`
                    SELECT id, username, role 
                    FROM users 
                    WHERE id IN (${placeholders})
                `, userIds, (err, users) => {
                    if (err) {
                        return res.status(500).json({ error: '查询失败' });
                    }
                    res.json(users);
                });
            });
        } else {
            // 普通用户只能看到自己
            res.json([{ id: user.id, username: user.username, role: user.role }]);
        }
    });
});

// 获取本机 IP 地址
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`
====================================
数据库版待办事项服务器已启动
====================================

本机访问: http://localhost:${PORT}/login.html
局域网访问: http://${localIP}:${PORT}/login.html

默认账号请查看 init-db.js 输出

按 Ctrl+C 停止服务器
====================================
    `);
});
