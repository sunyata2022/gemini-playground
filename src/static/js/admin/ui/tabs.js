// 标签页管理模块
const ACTIVE_TAB_KEY = 'admin_active_tab';

// 初始化标签页模块
export function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // 从 localStorage 恢复上次的 tab
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedTab) {
        switchTab(savedTab);
    } else {
        // 如果没有保存的 tab，使用第一个 tab
        const firstTab = tabButtons[0]?.dataset.tab;
        if (firstTab) {
            switchTab(firstTab);
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
}

export function switchTab(tabId) {
    // 保存到 localStorage
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);

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
