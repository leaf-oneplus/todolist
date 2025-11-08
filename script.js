// 待办事项数据
let todosWork1 = JSON.parse(localStorage.getItem('todosWork1')) || [];
let todosWork2 = JSON.parse(localStorage.getItem('todosWork2')) || [];
let currentWork = localStorage.getItem('currentWork') || 'work1';
let currentFilter = 'all';

// DOM 元素
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const todoCount = document.getElementById('todoCount');
const clearCompletedBtn = document.getElementById('clearCompleted');
const filterBtns = document.querySelectorAll('.filter-btn');
const workTabs = document.querySelectorAll('.work-tab');

// 初始化
init();

function init() {
    // 设置当前工作标签
    workTabs.forEach(tab => {
        if (tab.dataset.work === currentWork) {
            tab.classList.add('active');
        }
    });
    
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
            localStorage.setItem('currentWork', currentWork);
            renderTodos();
            updateStats();
        });
    });
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
function addTodo() {
    const text = todoInput.value.trim();
    
    if (text === '') {
        todoInput.focus();
        return;
    }
    
    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    const todos = getCurrentTodos();
    todos.unshift(todo);
    setCurrentTodos(todos);
    saveTodos();
    todoInput.value = '';
    todoInput.focus();
    renderTodos();
    updateStats();
}

// 切换完成状态
function toggleTodo(id) {
    const todos = getCurrentTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        // 记录完成时间或清除完成时间
        if (todo.completed) {
            todo.completedAt = new Date().toISOString();
        } else {
            delete todo.completedAt;
        }
        setCurrentTodos(todos);
        saveTodos();
        renderTodos();
        updateStats();
    }
}

// 删除待办事项
function deleteTodo(id) {
    let todos = getCurrentTodos();
    todos = todos.filter(t => t.id !== id);
    setCurrentTodos(todos);
    saveTodos();
    renderTodos();
    updateStats();
}

// 清除已完成
function clearCompleted() {
    let todos = getCurrentTodos();
    todos = todos.filter(t => !t.completed);
    setCurrentTodos(todos);
    saveTodos();
    renderTodos();
    updateStats();
}

// 渲染待办事项列表
function renderTodos() {
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
                <p>${currentFilter === 'completed' ? '还没有已完成的事项' : '暂无待办事项，添加一个吧！'}</p>
            </div>
        `;
        return;
    }
    
    todoList.innerHTML = filteredTodos.map(todo => `
        <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <div class="checkbox" onclick="toggleTodo(${todo.id})"></div>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                <div class="todo-time">
                    <span class="time-created" title="创建时间">📅 ${formatTime(todo.createdAt)}</span>
                    ${todo.completedAt ? `<span class="time-completed" title="完成时间">✅ ${formatTime(todo.completedAt)}</span>` : ''}
                </div>
            </div>
            <button class="delete-btn" onclick="deleteTodo(${todo.id})">删除</button>
        </li>
    `).join('');
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
    const activeCount = todos.filter(t => !t.completed).length;
    todoCount.textContent = `${activeCount} 个待办事项`;
    
    const hasCompleted = todos.some(t => t.completed);
    clearCompletedBtn.style.display = hasCompleted ? 'block' : 'none';
}

// 保存到本地存储
function saveTodos() {
    localStorage.setItem('todosWork1', JSON.stringify(todosWork1));
    localStorage.setItem('todosWork2', JSON.stringify(todosWork2));
}

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化时间
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    // 小于1分钟
    if (diff < 60000) {
        return '刚刚';
    }
    
    // 小于1小时
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
    }
    
    // 小于24小时
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }
    
    // 小于7天
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}天前`;
    }
    
    // 显示具体日期
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    // 如果是今年，不显示年份
    if (year === now.getFullYear()) {
        return `${month}-${day} ${hour}:${minute}`;
    }
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
}
