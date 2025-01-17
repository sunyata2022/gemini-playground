// 标签页管理模块
// 初始化标签页模块
export function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
}

export function switchTab(tabId) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    // 触发标签切换事件
    document.dispatchEvent(new CustomEvent('tab:changed', { detail: { tabId } }));
}
