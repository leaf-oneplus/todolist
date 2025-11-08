// 管理员控制台脚本
const API_URL = `${window.location.protocol}//${window.location.host}/api`;

let todosWork1 = [];
let todosWork2 = [];
let currentWork = 'work1';
let selectedUser = 'all';
let allUsers = new Set();
let adminUser = ''; // 动态获取当前登录用户名
let myTodoFilter = 'active'; // 'all', 'active', 'completed'

// 初始化
init();

async function init() {
    // 检查登录状态
    try {
        const response = await fetch(`${API_URL}/current-user`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        const user = await response.json();
        adminUser = user.username; // 保存当前用户名
        document.getElementById('adminUserName').textContent = user.username;
        
        // 如果不是管理员，跳转到普通用户页面
        if (user.role === 'user') {
            window.location.href = '/shared.html';
            return;
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
    
    await loadData();
    setupEventListeners();
    renderUserFilter();
    renderTodos();
    renderMyTodos();
    updateStats();
    
    // 定期刷新（管理员页面刷新更频繁，以便及时看到用户完成任务）
    setInterval(async () => {
        const oldHash = JSON.stringify({ todosWork1, todosWork2 });
        await loadData();
        const newHash = JSON.stringify({ todosWork1, todosWork2 });
        
        // 如果数据变化了，显示提示
        if (oldHash !== newHash) {
            console.log('数据已更新');
            renderMyTodos(); // 更新我的待办
        }
    }, 3000);
}

// 加载数据
async function loadData() {
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
        
        const oldData = JSON.stringify({ todosWork1, todosWork2 });
        todosWork1 = data.todosWork1 || [];
        todosWork2 = data.todosWork2 || [];
        const newData = JSON.stringify({ todosWork1, todosWork2 });
        
        // 收集所有用户
        allUsers.clear();
        [...todosWork1, ...todosWork2].forEach(todo => {
            if (todo.createdBy) {
                allUsers.add(todo.createdBy);
            }
            if (todo.assignedTo) {
                allUsers.add(todo.assignedTo);
            }
        });
        
        // 只有数据真的变化了才重新渲染
        if (oldData !== newData) {
            renderUserFilter();
            renderTodos();
            renderMyTodos();
            updateStats();
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 设置事件监听
function setupEventListeners() {
    // 不再需要工作区切换
}

// 渲染用户筛选
function renderUserFilter() {
    const filterContainer = document.getElementById('userFilter');
    
    // 更新"所有任务"计数
    const allCount = todosWork1.length + todosWork2.length;
    document.getElementById('allCount').textContent = allCount;
    
    // 清除旧的用户项
    filterContainer.querySelectorAll('[data-user]:not([data-user="all"])').forEach(el => el.remove());
    
    // 重新绑定"所有任务"的点击事件
    const allItem = filterContainer.querySelector('[data-user="all"]');
    if (allItem) {
        allItem.onclick = () => selectUser('all');
    }
    
    // 添加用户项
    Array.from(allUsers).sort().forEach(user => {
        const userTodos = [...todosWork1, ...todosWork2].filter(t => 
            t.createdBy === user || t.assignedTo === user
        );
        
        const item = document.createElement('div');
        item.className = 'user-filter-item';
        item.dataset.user = user;
        item.innerHTML = `
            <span>👤 ${user}</span>
            <span class="user-badge">${userTodos.length}</span>
        `;
        item.onclick = () => selectUser(user);
        filterContainer.appendChild(item);
    });
}

// 选择用户
function selectUser(user) {
    console.log('选择用户:', user); // 调试日志
    selectedUser = user;
    
    // 更新所有筛选项的激活状态
    document.querySelectorAll('.user-filter-item').forEach(item => {
        if (item.dataset.user === user) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 更新标题
    const title = user === 'all' ? '所有待办事项' : `${user} 的待办事项`;
    document.getElementById('panelTitle').textContent = title;
    
    // 重新渲染任务列表
    renderTodos();
}

// 渲染待办事项
function renderTodos() {
    const todos = currentWork === 'work1' ? todosWork1 : todosWork2;
    
    console.log('当前工作区:', currentWork, '任务数:', todos.length); // 调试日志
    console.log('选中用户:', selectedUser); // 调试日志
    
    const filteredTodos = selectedUser === 'all' 
        ? todos 
        : todos.filter(t => t.createdBy === selectedUser || t.assignedTo === selectedUser);
    
    console.log('筛选后任务数:', filteredTodos.length); // 调试日志
    
    const container = document.getElementById('adminTodoList');
    
    if (filteredTodos.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 80px 40px; color: rgba(255, 255, 255, 0.4); font-size: 16px;">暂无待办事项</div>';
        return;
    }
    
    container.innerHTML = filteredTodos.map(todo => {
        const owner = todo.assignedTo || todo.createdBy || '未知';
        const ownerColor = getUserColor(owner);
        const statusIcon = todo.completed ? '✅' : '⏳';
        const statusText = todo.completed ? '已完成' : '进行中';
        const statusColor = todo.completed ? '#4caf50' : '#ff9800';
        
        return `
            <div class="admin-todo-item ${todo.completed ? 'completed' : ''}">
                <div class="status-indicator" style="background: ${statusColor}; width: 4px; height: 100%; position: absolute; left: 0; top: 0; border-radius: 8px 0 0 8px;"></div>
                <div style="flex: 1; padding-left: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="font-size: 16px; ${todo.completed ? 'text-decoration: line-through; color: #999;' : ''}">${escapeHtml(todo.text)}</span>
                        <span style="font-size: 12px; padding: 2px 8px; background: ${statusColor}20; color: ${statusColor}; border-radius: 10px; font-weight: 600;">
                            ${statusIcon} ${statusText}
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #999;">
                        创建者: ${todo.createdBy || '未知'} 
                        ${todo.assignedTo ? `| 负责人: ${todo.assignedTo}` : ''}
                        | 创建于: ${formatTime(todo.createdAt)}
                        ${todo.completedAt ? `| 完成于: ${formatTime(todo.completedAt)}` : ''}
                    </div>
                </div>
                <div class="todo-owner" style="background: ${ownerColor}20; color: ${ownerColor}; border: 1px solid ${ownerColor}40;">
                    ${owner}
                </div>
                <div class="todo-actions">
                    ${!todo.completed ? `<button class="action-btn reassign-btn" onclick="reassignTodo(${todo.id})">重新分配</button>` : ''}
                    <button class="action-btn delete-btn-admin" onclick="deleteTodo(${todo.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 更新统计
function updateStats() {
    const allTodos = [...todosWork1, ...todosWork2];
    document.getElementById('totalUsers').textContent = allUsers.size;
    document.getElementById('totalTodos').textContent = allTodos.length;
    document.getElementById('completedTodos').textContent = allTodos.filter(t => t.completed).length;
}

// 渲染我的待办
function renderMyTodos() {
    let myTodos = [...todosWork1, ...todosWork2].filter(t => 
        t.createdBy === adminUser || t.assignedTo === adminUser
    );
    
    // 根据筛选条件过滤
    if (myTodoFilter === 'active') {
        myTodos = myTodos.filter(t => !t.completed);
    } else if (myTodoFilter === 'completed') {
        myTodos = myTodos.filter(t => t.completed);
    }
    
    const container = document.getElementById('myTodoList');
    
    if (myTodos.length === 0) {
        const emptyText = myTodoFilter === 'completed' ? '还没有已完成的任务' : '暂无待办事项';
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">${emptyText}</div>`;
    } else {
        container.innerHTML = myTodos.map(todo => `
            <div class="my-todo-item ${todo.completed ? 'completed' : ''}">
                <div class="my-checkbox" onclick="toggleMyTodo(${todo.id})"></div>
                <div class="my-todo-text">${escapeHtml(todo.text)}</div>
                <button class="my-delete-btn" onclick="deleteMyTodo(${todo.id})">删除</button>
            </div>
        `).join('');
    }
    
    // 更新统计和筛选按钮状态
    const allMyTodos = [...todosWork1, ...todosWork2].filter(t => 
        t.createdBy === adminUser || t.assignedTo === adminUser
    );
    const activeCount = allMyTodos.filter(t => !t.completed).length;
    const completedCount = allMyTodos.filter(t => t.completed).length;
    
    document.getElementById('myActiveCount').textContent = `${activeCount} 个待办`;
    document.getElementById('myCompletedCount').textContent = `${completedCount} 个已完成`;
    
    // 更新筛选按钮状态
    document.querySelectorAll('.my-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === myTodoFilter);
    });
}

// 切换我的待办筛选
function setMyTodoFilter(filter) {
    myTodoFilter = filter;
    renderMyTodos();
}

// 添加我的待办
async function addMyTodo() {
    const input = document.getElementById('myTodoInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    try {
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
        
        input.value = '';
        await loadData();
    } catch (error) {
        console.error('添加失败:', error);
        alert('添加失败，请重试');
    }
}

// 切换我的待办完成状态
async function toggleMyTodo(id) {
    try {
        const allTodos = [...todosWork1, ...todosWork2];
        const todo = allTodos.find(t => t.id === id);
        if (!todo) return;
        
        const newCompleted = !todo.completed;
        
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
        
        await loadData();
    } catch (error) {
        console.error('更新失败:', error);
        alert('更新失败，请重试');
    }
}

// 删除我的待办
async function deleteMyTodo(id) {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    try {
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('删除失败');
        }
        
        await loadData();
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
    }
}

// 管理员不能直接完成任务，只能查看状态
// 任务由负责人自己完成

// 删除任务
async function deleteTodo(id) {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    try {
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('删除失败');
        }
        
        await loadData();
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
    }
}

// 重新分配任务
async function reassignTodo(id) {
    const newOwner = prompt('分配给（输入用户名）：');
    if (!newOwner || !newOwner.trim()) return;
    
    try {
        const response = await fetch(`${API_URL}/todos/${id}/reassign`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ assignedTo: newOwner.trim() })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '分配失败');
        }
        
        await loadData();
    } catch (error) {
        console.error('重新分配失败:', error);
        alert(error.message || '分配失败，请重试');
    }
}

// 打开分配模态框
async function openAssignModal() {
    const modal = document.getElementById('assignModal');
    const select = document.getElementById('assignTo');
    
    try {
        // 从服务器获取用户列表
        const response = await fetch(`${API_URL}/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('获取用户列表失败');
        }
        
        const users = await response.json();
        
        // 填充用户列表
        select.innerHTML = '<option value="">选择用户...</option>' + 
            users.map(user => 
                `<option value="${user.username}">${user.username} (${getRoleText(user.role)})</option>`
            ).join('');
        
        modal.classList.add('show');
    } catch (error) {
        console.error('获取用户列表失败:', error);
        alert('获取用户列表失败，请重试');
    }
}

// 获取角色文本
function getRoleText(role) {
    switch(role) {
        case 'super_admin': return '超级管理员';
        case 'admin': return '部门管理员';
        case 'user': return '普通用户';
        default: return role;
    }
}

// 关闭分配模态框
function closeAssignModal() {
    document.getElementById('assignModal').classList.remove('show');
    document.getElementById('taskContent').value = '';
}

// 提交分配
async function submitAssign() {
    const content = document.getElementById('taskContent').value.trim();
    const assignTo = document.getElementById('assignTo').value;
    
    if (!content) {
        alert('请输入任务内容');
        return;
    }
    
    if (!assignTo) {
        alert('请选择分配对象');
        return;
    }
    
    try {
        // 调用数据库 API
        const response = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ 
                text: content,
                assignedTo: assignTo
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '分配失败');
        }
        
        closeAssignModal();
        await loadData();
    } catch (error) {
        console.error('分配失败:', error);
        alert(error.message || '分配失败，请重试');
    }
}

// 不再需要 saveData 函数，所有操作直接调用 API

// 工具函数
function getUserColor(username) {
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57'];
    const index = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${month}-${day} ${hour}:${minute}`;
}

// 创建粒子背景
function createParticles() {
    const particlesContainer = document.getElementById('adminParticles');
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

// 退出登录
async function adminLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    
    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('退出登录失败:', error);
    }
    
    window.location.href = '/login.html';
}
