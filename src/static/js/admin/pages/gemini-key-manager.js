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
        errorMessage: document.getElementById('geminiKeyErrorMessage'),
        cancelCreateBtn: document.getElementById('cancelCreateGeminiKey'),
        confirmCreateBtn: document.getElementById('confirmCreateGeminiKey'),
        
        // 获取全局元素
        messageDialog: document.getElementById('messageDialog'),
        messageText: document.getElementById('messageText'),
        confirmMessage: document.getElementById('confirmMessage'),

        // 当前过滤状态
        currentFilter: 'active',
        allKeys: { active: [], inactive: [] }
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

    // 添加过滤按钮事件
    document.querySelectorAll('#gemini .filter-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('#gemini .filter-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            manager.currentFilter = button.dataset.filter;
            renderKeys(manager);
        });
    });
}

function toggleClearButton(manager) {
    manager.clearSearchBtn.style.display = manager.searchInput.value ? 'block' : 'none';
}

function clearSearch(manager) {
    manager.searchInput.value = '';
    toggleClearButton(manager);
    renderKeys(manager);
}

function handleSearch(manager) {
    const searchTerm = manager.searchInput.value.toLowerCase();
    renderKeys(manager, searchTerm);
}

async function loadKeys(manager) {
    try {
        const api = getApi();
        const keys = await api.getGeminiKeys();
        manager.allKeys = keys; // 存储所有keys
        renderKeys(manager);
    } catch (error) {
        console.error('Error loading Gemini keys:', error);
        showMessage(manager, '加载Gemini keys失败', 'error');
    }
}

function renderKeys(manager, searchTerm = '') {
    const { active, inactive } = manager.allKeys;
    let keysToShow = [];
    
    // 根据过滤条件选择要显示的keys
    if (manager.currentFilter === 'active') {
        keysToShow = active;
    } else if (manager.currentFilter === 'inactive') {
        keysToShow = inactive;
    } else {
        keysToShow = [...active, ...inactive];
    }

    // 应用搜索过滤
    if (searchTerm) {
        keysToShow = keysToShow.filter(key => 
            key.key.toLowerCase().includes(searchTerm) ||
            key.account.toLowerCase().includes(searchTerm) ||
            (key.note && key.note.toLowerCase().includes(searchTerm))
        );
    }

    // 渲染keys
    manager.keysList.innerHTML = keysToShow.map(key => `
        <div class="key-item ${manager.currentFilter === 'all' ? (active.includes(key) ? 'active' : 'inactive') : ''}">
            <div class="key-info">
                <div class="key-main">
                    <span class="key-text">${key.key}</span>
                    <span class="key-account">${key.account}</span>
                </div>
                ${key.note ? `<div class="key-note">${key.note}</div>` : ''}
                ${key.errorCount ? `<div class="key-error">错误次数: ${key.errorCount}</div>` : ''}
            </div>
            <div class="key-actions">
                <button onclick="editKey('${key.key}')">编辑</button>
                <button onclick="deleteKey('${key.key}')">删除</button>
            </div>
        </div>
    `).join('');
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
    manager.createDialog.style.display = 'block';
    manager.geminiKeyInput.value = '';
    manager.geminiAccountInput.value = '';
    manager.geminiKeyNoteInput.value = '';
    manager.errorMessage.style.display = 'none';
    manager.errorMessage.textContent = '';
}

function hideCreateDialog(manager) {
    manager.createDialog.style.display = 'none';
    manager.errorMessage.style.display = 'none';
    manager.errorMessage.textContent = '';
}

function showDialogError(manager, message) {
    manager.errorMessage.textContent = message;
    manager.errorMessage.style.display = 'block';
}

async function handleCreateKey(manager) {
    const key = manager.geminiKeyInput.value.trim();
    const account = manager.geminiAccountInput.value.trim();
    const note = manager.geminiKeyNoteInput.value.trim();

    if (!key || !account) {
        showDialogError(manager, '请填写完整的Key信息');
        return;
    }

    try {
        const api = getApi();
        const response = await api.addGeminiKey({ key, account, note });
        
        if (response.error) {
            showDialogError(manager, response.error);
            return;
        }

        hideCreateDialog(manager);
        loadKeys(manager);  // 重新加载列表
    } catch (error) {
        console.error('Error creating Gemini key:', error);
        showDialogError(manager, error.message || '添加Gemini Key失败');
    }
}
