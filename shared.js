// 多人共享版本的脚本
// 自动检测服务器地址
const API_URL = `${window.location.protocol}//${window.location.host}/api`;

// 待办事项数据
let todosWork1 = [];
let todosWork2 = [];
let currentWork = 'work1';
let currentFilter = 'all';
let isSyncing = false;
let syncInterval;
let currentUser = localStorage.getItem('todoUser') || '';
let lastDataHash = ''; // 用于检测数据是否真的变化了

// 用户颜色映射
const userColors = {};
const colorPalette = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', 
    '#fa709a', '#feca57', '#48dbfb', '#ff6b6b',
    '#ee5a6f', '#c44569', '#786fa6', '#f8b500'
];

// 获取用户颜色
function getUserColor(username) {
    if (!userColors[username]) {
        const index = Object.keys(userColors).length % colorPalette.length;
        userColors[username] = colorPalette[index];
    }
    return userColors[username];
}

// DOM 元素
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const todoCount = document.getElementById('todoCount');
const clearCompletedBtn = document.getElementById('clearCompleted');
const filterBtns = document.querySelectorAll('.filter-btn');
const workTabs = document.querySelectorAll('.work-tab');
const syncIndicator = document.getElementById('syncIndicator');
const syncText = document.getElementById('syncText');

// 初始化
init();

async function init() {
    // 检查登录状态并获取用户信息
    try {
        const response = await fetch(`${API_URL}/current-user`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            // 未登录，跳转到登录页
            window.location.href = '/login.html';
            return;
        }
        
        const user = await response.json();
        currentUser = user.username;
        
        // 显示当前用户
        document.getElementById('currentUserName').textContent = currentUser;
    } catch (error) {
        console.error('获取用户信息失败:', error);
        // 如果是旧版本服务器，使用本地存储的用户名
        if (!currentUser) {
            currentUser = localStorage.getItem('todoUser') || prompt('请输入你的名字：', '用户' + Math.floor(Math.random() * 1000));
            if (currentUser) {
                localStorage.setItem('todoUser', currentUser);
            } else {
                currentUser = '匿名用户';
            }
        }
        document.getElementById('currentUserName').textContent = currentUser;
    }
    
    // 设置当前工作标签
    workTabs.forEach(tab => {
        if (tab.dataset.work === currentWork) {
            tab.classList.add('active');
        }
    });
    
    // 从服务器加载数据
    await loadFromServer();
    
    renderTodos();
    updateStats();
    
    // 事件监听
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    
    clearCompletedBtn.addEventListener('click', clearCompleted);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });
    
    workTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            workTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentWork = tab.dataset.work;
            renderTodos();
            updateStats();
        });
    });
    
    // 定期从服务器同步数据（每5秒，减少频率）
    syncInterval = setInterval(loadFromServer, 5000);
}

// 计算数据哈希值
function getDataHash(data) {
    return JSON.stringify(data);
}

// 从服务器加载数据
async function loadFromServer() {
    try {
        const response = await fetch(`${API_URL}/todos`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            throw new Error('加载失败');
        }
        
        const data = await response.json();
        
        // 计算新数据的哈希值
        const newHash = getDataHash(data);
        
        // 只有数据真的变化了才更新界面
        if (newHash !== lastDataHash) {
            todosWork1 = data.todosWork1 || [];
            todosWork2 = data.todosWork2 || [];
            lastDataHash = newHash;
            
            renderTodos();
            updateStats();
        }
        
        updateSyncStatus('synced');
    } catch (error) {
        console.error('加载数据失败:', error);
        updateSyncStatus('error');
    }
}

// 不再需要 saveToServer，所有操作直接调用 API

// 更新同步状态
function updateSyncStatus(status) {
    syncIndicator.className = 'sync-indicator';
    
    switch (status) {
        case 'synced':
            syncText.textContent = '已同步';
            break;
        case 'syncing':
            syncIndicator.classList.add('syncing');
            syncText.textContent = '同步中...';
            break;
        case 'error':
            syncIndicator.classList.add('error');
            syncText.textContent = '同步失败';
            break;
    }
}

// 获取当前工作的待办事项
function getCurrentTodos() {
    return currentWork === 'work1' ? todosWork1 : todosWork2;
}

// 设置当前工作的待办事项
function setCurrentTodos(todos) {
    if (currentWork === 'work1') {
        todosWork1 = todos;
    } else {
        todosWork2 = todos;
    }
}

// 添加待办事项
async function addTodo() {
    const text = todoInput.value.trim();
    
    if (text === '') {
        todoInput.focus();
        return;
    }
    
    try {
        updateSyncStatus('syncing');
        
        // 直接调用数据库 API
        const response = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            throw new Error('添加失败');
        }
        
        todoInput.value = '';
        todoInput.focus();
        
        // 重新加载数据
        await loadFromServer();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('添加待办失败:', error);
        updateSyncStatus('error');
        alert('添加失败，请重试');
    }
}

// 切换完成状态
async function toggleTodo(id) {
    try {
        updateSyncStatus('syncing');
        
        const todos = getCurrentTodos();
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        
        const newCompleted = !todo.completed;
        
        // 调用数据库 API
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ completed: newCompleted })
        });
        
        if (!response.ok) {
            throw new Error('更新失败');
        }
        
        // 重新加载数据
        await loadFromServer();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('更新待办失败:', error);
        updateSyncStatus('error');
        alert('更新失败，请重试');
    }
}

// 删除待办事项
async function deleteTodo(id) {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    try {
        updateSyncStatus('syncing');
        
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('删除失败');
        }
        
        // 重新加载数据
        await loadFromServer();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('删除待办失败:', error);
        updateSyncStatus('error');
        alert('删除失败，请重试');
    }
}

// 清除已完成
async function clearCompleted() {
    if (!confirm('确定要清除所有已完成的任务吗？')) return;
    
    try {
        updateSyncStatus('syncing');
        
        const todos = getCurrentTodos();
        const completedTodos = todos.filter(t => t.completed);
        
        // 逐个删除已完成的任务
        for (const todo of completedTodos) {
            await fetch(`${API_URL}/todos/${todo.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        }
        
        // 重新加载数据
        await loadFromServer();
        updateSyncStatus('synced');
    } catch (error) {
        console.error('清除失败:', error);
        updateSyncStatus('error');
        alert('清除失败，请重试');
    }
}

// 渲染待办事项列表
function renderTodos() {
    let filteredTodos = getFilteredTodos();
    
    // 普通用户只能看到自己的任务（创建的或分配给自己的）
    filteredTodos = filteredTodos.filter(todo => 
        todo.createdBy === currentUser || todo.assignedTo === currentUser
    );
    
    // 生成新的 HTML
    const newHTML = filteredTodos.length === 0 
        ? `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
                <p>${currentFilter === 'completed' ? '还没有已完成的事项' : '暂无待办事项，添加一个吧！'}</p>
            </div>`
        : filteredTodos.map(todo => {
            const userColor = getUserColor(todo.createdBy || '未知');
            const isMyTodo = todo.createdBy === currentUser;
            
            return `
            <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <div class="checkbox" onclick="toggleTodo(${todo.id})"></div>
                <div class="todo-content">
                    <div class="todo-header">
                        <span class="todo-text">${escapeHtml(todo.text)}</span>
                        <span class="todo-user" style="background: ${userColor}20; color: ${userColor}; border-color: ${userColor}40;">
                            ${isMyTodo ? '👤 我' : '👥 ' + escapeHtml(todo.createdBy || '未知')}
                        </span>
                    </div>
                    <div class="todo-time">
                        <span class="time-created" title="创建时间">📅 ${formatTime(todo.createdAt)}</span>
                        ${todo.completedAt ? `<span class="time-completed" title="完成时间">✅ ${formatTime(todo.completedAt)}</span>` : ''}
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteTodo(${todo.id})">删除</button>
            </li>
        `}).join('');
    
    // 只有内容真的变化了才更新 DOM
    if (todoList.innerHTML !== newHTML) {
        todoList.innerHTML = newHTML;
    }
}

// 获取过滤后的待办事项
function getFilteredTodos() {
    const todos = getCurrentTodos();
    switch (currentFilter) {
        case 'active':
            return todos.filter(t => !t.completed);
        case 'completed':
            return todos.filter(t => t.completed);
        default:
            return todos;
    }
}

// 更新统计信息
function updateStats() {
    const todos = getCurrentTodos();
    // 只统计自己的任务
    const myTodos = todos.filter(t => t.createdBy === currentUser || t.assignedTo === currentUser);
    const activeCount = myTodos.filter(t => !t.completed).length;
    todoCount.textContent = `${activeCount} 个待办事项`;
    
    const hasCompleted = myTodos.some(t => t.completed);
    clearCompletedBtn.style.display = hasCompleted ? 'block' : 'none';
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化时间
function formatTime(dateString) {
    if (!dateString) return '';
    
    // 处理 SQLite 的日期格式
    const date = new Date(dateString.replace(' ', 'T'));
    
    if (isNaN(date.getTime())) {
        return dateString; // 如果无法解析，返回原始字符串
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    if (year === now.getFullYear()) {
        return `${month}-${day} ${hour}:${minute}`;
    }
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

// 退出登录
async function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('退出登录失败:', error);
    }
    
    // 跳转到登录页
    window.location.href = '/login.html';
}

// 创建粒子背景
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 4 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 20 + 15}s`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        
        particlesContainer.appendChild(particle);
    }
}

// 页面加载时创建粒子
createParticles();

// 页面关闭时清理
window.addEventListener('beforeunload', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});
