// 桌面模式功能
const transparentBtn = document.getElementById('transparentBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const todoContainer = document.getElementById('todoContainer');
const dragHandle = document.querySelector('.drag-handle');

let isTransparent = false;
let isMinimized = false;
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

// 透明模式切换
transparentBtn.addEventListener('click', () => {
    isTransparent = !isTransparent;
    document.body.classList.toggle('transparent', isTransparent);
    transparentBtn.classList.toggle('active', isTransparent);
    localStorage.setItem('desktopTransparent', isTransparent);
});

// 最小化切换
minimizeBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    document.body.classList.toggle('minimized', isMinimized);
    minimizeBtn.classList.toggle('active', isMinimized);
});

// 拖拽功能
dragHandle.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === dragHandle || dragHandle.contains(e.target)) {
        isDragging = true;
        dragHandle.style.cursor = 'grabbing';
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, todoContainer);
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    dragHandle.style.cursor = 'move';
    
    // 保存位置
    localStorage.setItem('desktopPosition', JSON.stringify({ x: xOffset, y: yOffset }));
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
}

// 恢复保存的设置
function restoreSettings() {
    // 恢复透明模式
    const savedTransparent = localStorage.getItem('desktopTransparent');
    if (savedTransparent === 'true') {
        isTransparent = true;
        document.body.classList.add('transparent');
        transparentBtn.classList.add('active');
    }
    
    // 恢复位置
    const savedPosition = localStorage.getItem('desktopPosition');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        xOffset = x;
        yOffset = y;
        setTranslate(x, y, todoContainer);
    }
}

// 初始化
restoreSettings();

// 双击标题栏最小化/恢复
dragHandle.addEventListener('dblclick', () => {
    minimizeBtn.click();
});

// 提示用户如何使用
if (!localStorage.getItem('desktopTipShown')) {
    setTimeout(() => {
        alert('💡 使用提示：\n\n' +
              '• 拖动标题栏可以移动窗口\n' +
              '• 点击透明按钮开启透明模式\n' +
              '• 点击最小化按钮折叠窗口\n' +
              '• 双击标题栏快速折叠/展开\n\n' +
              '注意：浏览器窗口需要保持打开才能使用');
        localStorage.setItem('desktopTipShown', 'true');
    }, 1000);
}
