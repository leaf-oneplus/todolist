// 简单的 Node.js 后端服务器
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'todos-data.json');

// 初始化数据文件
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        todosWork1: [],
        todosWork2: []
    }));
}

// 读取数据
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { todosWork1: [], todosWork2: [] };
    }
}

// 写入数据
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API 路由

// 获取所有待办事项
app.get('/api/todos', (req, res) => {
    const data = readData();
    res.json(data);
});

// 更新待办事项
app.post('/api/todos', (req, res) => {
    const { todosWork1, todosWork2 } = req.body;
    writeData({ todosWork1, todosWork2 });
    res.json({ success: true });
});

// 获取单个工作区的待办事项
app.get('/api/todos/:workId', (req, res) => {
    const data = readData();
    const workId = req.params.workId;
    res.json(data[workId] || []);
});

// 更新单个工作区的待办事项
app.post('/api/todos/:workId', (req, res) => {
    const workId = req.params.workId;
    const todos = req.body;
    const data = readData();
    data[workId] = todos;
    writeData(data);
    res.json({ success: true });
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
多人共享待办事项服务器已启动
====================================

本机访问: http://localhost:${PORT}/shared.html
局域网访问: http://${localIP}:${PORT}/shared.html

分享给团队成员:
→ http://${localIP}:${PORT}/shared.html

所有人的修改会实时同步

按 Ctrl+C 停止服务器
====================================
    `);
});
