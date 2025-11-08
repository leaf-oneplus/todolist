// 获取数据
let todosWork1 = JSON.parse(localStorage.getItem('todosWork1')) || [];
let todosWork2 = JSON.parse(localStorage.getItem('todosWork2')) || [];

// 更新时钟
function updateClock() {
    const now = new Date();
    
    // 更新时间
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
    
    // 更新日期
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[now.getDay()];
    document.getElementById('date').textContent = `${year}年${month}月${day}日 ${weekday}`;
}

// 格式化时间
function formatTime(isoString) {
    const date = new Date(isoString);
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

// 转义 HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 渲染待办事项
function renderTodos() {
    renderWorkTodos('work1', todosWork1);
    renderWorkTodos('work2', todosWork2);
}

function renderWorkTodos(workId, todos) {
    const listElement = document.getElementById(`${workId}List`);
    const statsElement = document.getElementById(`${workId}Stats`);
    const completedElement = document.getElementById(`${workId}Completed`);
    
    // 只显示未完成的待办事项（最多显示5个）
    const activeTodos = todos.filter(t => !t.completed).slice(0, 5);
    const completedCount = todos.filter(t => t.completed).length;
    const activeCount = todos.filter(t => !t.completed).length;
    
    if (activeTodos.length === 0) {
        listElement.innerHTML = '<div class="empty-work">✨ 暂无待办事项</div>';
    } else {
        listElement.innerHTML = activeTodos.map(todo => `
            <li class="wallpaper-todo-item ${todo.completed ? 'completed' : ''}">
                <div class="wallpaper-checkbox"></div>
                <span class="wallpaper-todo-text">${escapeHtml(todo.text)}</span>
                <span class="wallpaper-todo-time">${formatTime(todo.createdAt)}</span>
            </li>
        `).join('');
    }
    
    statsElement.textContent = `${activeCount} 个待办`;
    completedElement.textContent = `${completedCount} 个已完成`;
}

// 创建粒子
function createParticles() {
    const particlesContainer = document.getElementById('particles');
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

// 打开编辑器
function openEditor() {
    window.open('index.html', '_blank', 'width=600,height=800');
}

// 监听存储变化
window.addEventListener('storage', (e) => {
    if (e.key === 'todosWork1' || e.key === 'todosWork2') {
        todosWork1 = JSON.parse(localStorage.getItem('todosWork1')) || [];
        todosWork2 = JSON.parse(localStorage.getItem('todosWork2')) || [];
        renderTodos();
    }
});

// 初始化
updateClock();
setInterval(updateClock, 1000);
createParticles();
renderTodos();

// 每30秒刷新一次待办事项
setInterval(() => {
    todosWork1 = JSON.parse(localStorage.getItem('todosWork1')) || [];
    todosWork2 = JSON.parse(localStorage.getItem('todosWork2')) || [];
    renderTodos();
}, 30000);
