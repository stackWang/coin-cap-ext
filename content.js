// 创建信息栏元素
let infoBar = document.createElement('div');
infoBar.id = 'system-info-bar';
// document.body.appendChild(infoBar);

// 更新信息栏内容的函数
function updateInfoBar() {
    // 获取系统信息的方法取决于可用资源，这里假设我们有这些信息
    let currentTime = new Date().toLocaleTimeString();
    let displaySize = `${window.screen.width}x${window.screen.height}`;

    // 设置信息栏内容
    infoBar.innerHTML = `
    <span>Time: ${currentTime}</span>
    <span>Display Size: ${displaySize}</span>
    `;
}

// 初始化信息栏
updateInfoBar();

// 每秒更新一次信息栏内容
setInterval(updateInfoBar, 1000);