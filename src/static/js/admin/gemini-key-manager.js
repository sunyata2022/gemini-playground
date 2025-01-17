// Gemini Key管理模块
import { getApi } from './core.js';

export function initGeminiKeyManager(elements) {
    const manager = {
        searchInput: document.getElementById('searchGeminiInput'),
        clearSearchBtn: document.getElementById('clearGeminiSearch'),
        keysList: document.getElementById('geminiKeysListContent'),
        addKeyBtn: document.getElementById('createGeminiKeyBtn'),
        
        // 添加对话框元素
        createDialog: document.getElementById('createGeminiKeyDialog'),
        geminiKeyInput: document.getElementById('geminiKey'),
        geminiAccountInput: document.getElementById('geminiAccount'),
        geminiKeyNoteInput: document.getElementById('geminiKeyNote'),
        cancelCreateBtn: document.getElementById('cancelCreateGeminiKey'),
        confirmCreateBtn: document.getElementById('confirmCreateGeminiKey'),
        
        // 获取全局元素
        messageDialog: document.getElementById('messageDialog'),
        messageText: document.getElementById('messageText'),
        confirmMessage: document.getElementById('confirmMessage'),
    };

    // 初始化事件监听
    initEventListeners(manager);
        
    // 监听认证成功事件
    document.addEventListener('auth:success', () => {
        // 只在当前 tab 是 gemini 时加载数据
        if (document.querySelector('.tab-button[data-tab="gemini"]').classList.contains('active')) {
            loadKeys(manager);
        }
    });

    // 监听 tab 切换事件
    document.addEventListener('tab:changed', (e) => {
        if (e.detail.tabId === 'gemini') {
            loadKeys(manager);
        }
    });
}

function initEventListeners(manager) {
    // 搜索框事件
    manager.searchInput.addEventListener('input', () => {
        handleSearch(manager);
        toggleClearButton(manager);
    });

    manager.clearSearchBtn.addEventListener('click', () => {
        clearSearch(manager);
    });

    // 添加Key按钮事件
    manager.addKeyBtn.addEventListener('click', () => {
        showCreateDialog(manager);
    });

    // 添加对话框事件
    manager.cancelCreateBtn.addEventListener('click', () => {
        hideCreateDialog(manager);
    });

    manager.confirmCreateBtn.addEventListener('click', () => {
        handleCreateKey(manager);
    });
}

function toggleClearButton(manager) {
    manager.clearSearchBtn.style.display = manager.searchInput.value ? 'block' : 'none';
}

function clearSearch(manager) {
    manager.searchInput.value = '';
    toggleClearButton(manager);
    loadKeys(manager); // 重新加载所有keys
}

function handleSearch(manager) {
    const searchTerm = manager.searchInput.value.toLowerCase();
    const keys = Array.from(manager.keysList.children);
    
    keys.forEach(keyElement => {
        const keyText = keyElement.textContent.toLowerCase();
        const shouldShow = keyText.includes(searchTerm);
        keyElement.style.display = shouldShow ? 'block' : 'none';
    });
}

async function loadKeys(manager) {
    try {
        const api = getApi();
        const keys = await api.getGeminiKeys();
        renderKeys(manager, keys);
    } catch (error) {
        console.error('Error loading Gemini keys:', error);
        showMessage(manager, '加载Gemini keys失败', 'error');
    }
}

function renderKeys(manager, keys) {
    manager.keysList.innerHTML = '';
    
    if (keys.length === 0) {
        manager.keysList.innerHTML = '<div class="no-keys">暂无Gemini Keys</div>';
        return;
    }

    keys.forEach(key => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key-item';
        keyElement.innerHTML = `
            <div class="key-info">
                <div class="key-main">
                    <span class="key-text">${key.key.slice(0, 4)}...${key.key.slice(-4)}</span>
                    <span class="key-account">${key.account}</span>
                </div>
                <div class="key-details">
                    <span class="key-error-count">错误次数: ${key.errorCount}</span>
                    ${key.lastErrorAt ? `<span class="key-last-error">最后错误: ${new Date(key.lastErrorAt).toLocaleString()}</span>` : ''}
                    ${key.note ? `<span class="key-note">备注: ${key.note}</span>` : ''}
                </div>
            </div>
            <div class="key-actions">
                <button class="action-button edit" data-key="${key.key}">编辑</button>
                <button class="action-button delete" data-key="${key.key}">删除</button>
            </div>
        `;

        // 添加编辑和删除事件监听
        const editBtn = keyElement.querySelector('.edit');
        const deleteBtn = keyElement.querySelector('.delete');

        editBtn.addEventListener('click', () => editKey(key));
        deleteBtn.addEventListener('click', () => deleteKey(key));

        manager.keysList.appendChild(keyElement);
    });
}

function editKey(key) {
    // TODO: 实现编辑功能
}

function deleteKey(key) {
    // TODO: 实现删除功能
}

function showMessage(manager, message, type = 'info') {
    manager.messageText.textContent = message;
    manager.messageDialog.className = `dialog-overlay message-${type}`;
    manager.messageDialog.style.display = 'flex';

    // 自动关闭
    setTimeout(() => {
        manager.messageDialog.style.display = 'none';
    }, 3000);
}

function showCreateDialog(manager) {
    // 清空输入框
    manager.geminiKeyInput.value = '';
    manager.geminiAccountInput.value = '';
    manager.geminiKeyNoteInput.value = '';
    
    // 显示对话框
    manager.createDialog.style.display = 'flex';
}

function hideCreateDialog(manager) {
    manager.createDialog.style.display = 'none';
}

async function handleCreateKey(manager) {
    const key = manager.geminiKeyInput.value.trim();
    const account = manager.geminiAccountInput.value.trim();
    const note = manager.geminiKeyNoteInput.value.trim();

    if (!key) {
        showMessage(manager, '请输入Gemini Key', 'error');
        return;
    }

    if (!account) {
        showMessage(manager, '请输入账号', 'error');
        return;
    }

    try {
        const api = getApi();  // 每次调用时获取最新的 api 实例
        await api.addGeminiKey(key, account, note);
        showMessage(manager, '添加Gemini Key成功');
        hideCreateDialog(manager);
        loadKeys(manager); // 重新加载列表
    } catch (error) {
        console.error('Error adding Gemini key:', error);
        showMessage(manager, '添加Gemini Key失败', 'error');
    }
}
