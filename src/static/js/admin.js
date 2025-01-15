// Constants
const API_BASE_URL = '';
let ADMIN_TOKEN = localStorage.getItem('adminToken');

// 存储所有密钥的数组
let allKeys = [];

// 当前选中的筛选器
let currentFilter = 'active';

// Initialize the application
function initializeApp() {
    // Get DOM elements
    const elements = getElements();

    // Auth related events
    elements.authDialog?.addEventListener('click', () => authenticate(elements));
    elements.adminTokenInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate(elements);
    });

    // Key management related events
    elements.createKeyBtn?.addEventListener('click', () => showCreateKeyDialog(elements));
    elements.cancelCreateKey?.addEventListener('click', () => hideCreateKeyDialog(elements));
    elements.confirmCreateKey?.addEventListener('click', () => createNewKey(elements));
    elements.copyKeyBtn?.addEventListener('click', () => copyKeyInfo(elements));
    elements.closeKeyDialog?.addEventListener('click', () => hideKeyCreatedDialog(elements));

    // 消息对话框事件
    elements.confirmMessage?.addEventListener('click', () => hideMessageDialog(elements));

    // 确认对话框事件
    elements.confirmConfirm?.addEventListener('click', () => {
        hideConfirmDialog(elements);
        if (elements.confirmCallback) {
            elements.confirmCallback();
            elements.confirmCallback = null;
        }
    });
    elements.cancelConfirm?.addEventListener('click', () => {
        hideConfirmDialog(elements);
        elements.confirmCallback = null;
    });

    // Tab functionality
    elements.tabButtons?.forEach(button => {
        button?.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // 筛选按钮事件
    elements.filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 更新按钮状态
            elements.filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 更新当前筛选器
            currentFilter = button.dataset.filter;
            
            // 重新渲染列表
            const filteredKeys = filterAndSearchKeys(allKeys, elements.searchInput.value);
            renderKeysList(filteredKeys, elements);
        });
    });

    // 编辑备注对话框事件
    elements.confirmEditNote?.addEventListener('click', () => updateKeyNote(elements));
    elements.cancelEditNote?.addEventListener('click', () => hideEditNoteDialog(elements));

    // Check authentication on load
    if (!ADMIN_TOKEN) {
        showAuthDialog(elements);
    } else {
        verifyAndInitialize(elements);
    }

    // Return elements for use in other functions
    return elements;
}

function getElements() {
    return {
        // Auth related elements
        authDialog: document.getElementById('authDialog'),
        adminTokenInput: document.getElementById('adminToken'),
        confirmAuthBtn: document.getElementById('confirmAuth'),
        mainContent: document.getElementById('mainContent'),
        
        // Create key dialog elements
        createKeyBtn: document.getElementById('createKeyBtn'),
        createKeyDialog: document.getElementById('createKeyDialog'),
        validityDaysInput: document.getElementById('validityDays'),
        keyNoteInput: document.getElementById('keyNote'),
        confirmCreateKey: document.getElementById('confirmCreateKey'),
        cancelCreateKey: document.getElementById('cancelCreateKey'),
        
        // Key created dialog elements
        keyCreatedDialog: document.getElementById('keyCreatedDialog'),
        createdKeyDisplay: document.getElementById('createdKeyDisplay'),
        keyValidityDisplay: document.getElementById('keyValidityDisplay'),
        copyKeyBtn: document.getElementById('copyKeyBtn'),
        closeKeyDialog: document.getElementById('closeKeyDialog'),
        
        // Message dialog elements
        messageDialog: document.getElementById('messageDialog'),
        messageText: document.getElementById('messageText'),
        confirmMessage: document.getElementById('confirmMessage'),
        
        // Confirm dialog elements
        confirmDialog: document.getElementById('confirmDialog'),
        confirmText: document.getElementById('confirmText'),
        confirmConfirm: document.getElementById('confirmConfirm'),
        cancelConfirm: document.getElementById('cancelConfirm'),
        
        // Search and list elements
        searchInput: document.getElementById('searchInput'),
        keysListContent: document.querySelector('.keys-list-content'),
        filterButtons: document.querySelectorAll('.filter-button'),
        
        // Tab elements
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // 编辑备注对话框元素
        editNoteDialog: document.getElementById('editNoteDialog'),
        editNoteInput: document.getElementById('editNoteInput'),
        confirmEditNote: document.getElementById('confirmEditNote'),
        cancelEditNote: document.getElementById('cancelEditNote'),
    };
}

// 显示消息对话框
function showMessageDialog(elements, message, type = 'info') {
    elements.messageText.textContent = message;
    elements.messageText.className = `message-${type}`;
    elements.messageDialog.classList.add('active');
}

// 隐藏消息对话框
function hideMessageDialog(elements) {
    elements.messageDialog.classList.remove('active');
}

// 显示确认对话框
function showConfirmDialog(elements, message, callback) {
    elements.confirmText.textContent = message;
    elements.confirmCallback = callback;
    elements.confirmDialog.classList.add('active');
}

// 隐藏确认对话框
function hideConfirmDialog(elements) {
    elements.confirmDialog.classList.remove('active');
}

// Authentication Functions
function showAuthDialog(elements) {
    elements.authDialog.classList.add('active');
    elements.mainContent.style.display = 'none';
    elements.adminTokenInput.focus();
}

async function authenticate(elements) {
    const token = elements.adminTokenInput.value.trim();
    if (!token) {
        showMessageDialog(elements, '请输入管理员令牌', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('无效的令牌');
        }

        // Store token and initialize
        ADMIN_TOKEN = token;
        localStorage.setItem('adminToken', token);
        elements.authDialog.classList.remove('active');
        elements.mainContent.style.display = 'block';
        elements.adminTokenInput.value = '';
        
        // Initialize the app
        loadKeys(elements);
    } catch (error) {
        console.error('认证错误:', error);
        showMessageDialog(elements, '无效的管理员令牌，请重试', 'error');
        elements.adminTokenInput.value = '';
        elements.adminTokenInput.focus();
    }
}

async function verifyAndInitialize(elements) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error('无效的令牌');
        }

        // Token is valid, show content and initialize
        elements.authDialog.classList.remove('active');
        elements.mainContent.style.display = 'block';
        loadKeys(elements);
    } catch (error) {
        console.error('令牌验证错误:', error);
        localStorage.removeItem('adminToken');
        ADMIN_TOKEN = null;
        showAuthDialog(elements);
    }
}

// Key Management Functions
function showCreateKeyDialog(elements) {
    elements.createKeyDialog.classList.add('active');
}

function hideCreateKeyDialog(elements) {
    elements.createKeyDialog.classList.remove('active');
    elements.validityDaysInput.value = '30';
    elements.keyNoteInput.value = '';
}

function showKeyCreatedDialog(elements, key, validity) {
    elements.createdKeyDisplay.textContent = key;
    elements.keyValidityDisplay.textContent = `${validity} 天`;
    elements.keyCreatedDialog.classList.add('active');
}

function hideKeyCreatedDialog(elements) {
    elements.keyCreatedDialog.classList.remove('active');
}

async function createNewKey(elements) {
    const validityDays = parseInt(elements.validityDaysInput.value);
    const note = elements.keyNoteInput.value;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            },
            body: JSON.stringify({ validityDays, note })
        });

        if (!response.ok) throw new Error('创建密钥失败');

        const data = await response.json();
        hideCreateKeyDialog(elements);
        showKeyCreatedDialog(elements, data.key, validityDays);
        loadKeys(elements); // Refresh the keys list
    } catch (error) {
        console.error('创建密钥错误:', error);
        showMessageDialog(elements, '创建密钥失败，请重试', 'error');
    }
}

async function loadKeys(elements) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        if (!response.ok) throw new Error('加载密钥失败');

        const data = await response.json();
        allKeys = data.keys; // 保存所有密钥
        const filteredKeys = filterAndSearchKeys(allKeys, elements.searchInput.value);
        renderKeysList(filteredKeys, elements);
    } catch (error) {
        console.error('加载密钥错误:', error);
        showMessageDialog(elements, '加载密钥失败，请重试', 'error');
    }
}

// 检查密钥是否有效
function isKeyValid(key) {
    return key.info.active && new Date(key.info.expiresAt) > new Date();
}

// 格式化日期
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// 获取密钥来源的显示文本
function getSourceText(source) {
    const sourceMap = {
        'admin_manual': '管理员创建',
        'admin_api': 'API创建',
        'code_exchange': '激活码兑换'
    };
    return sourceMap[source] || '未知来源';
}

// 筛选和搜索密钥
function filterAndSearchKeys(keys, searchQuery) {
    // 先按状态筛选
    let filteredKeys = keys;
    if (currentFilter !== 'all') {
        const isActive = currentFilter === 'active';
        filteredKeys = keys.filter(key => isKeyValid(key) === isActive);
    }
    
    // 再按搜索词筛选
    if (searchQuery) {
        searchQuery = searchQuery.toLowerCase().trim();
        filteredKeys = filteredKeys.filter(key => {
            const searchFields = [
                key.key,
                key.info.note,
                formatDate(key.info.createdAt),
                formatDate(key.info.expiresAt),
                isKeyValid(key) ? '有效' : '已失效',
                getSourceText(key.info.source)
            ];
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(searchQuery)
            );
        });
    }
    
    return filteredKeys;
}

// 显示编辑备注对话框
function showEditNoteDialog(elements, key) {
    const dialog = elements.editNoteDialog;
    const input = elements.editNoteInput;
    
    // 设置当前密钥的备注
    const keyData = allKeys.find(k => k.key === key);
    input.value = keyData?.info.note || '';
    
    // 存储当前编辑的密钥
    dialog.dataset.key = key;
    
    dialog.style.display = 'flex';
}

// 隐藏编辑备注对话框
function hideEditNoteDialog(elements) {
    elements.editNoteDialog.style.display = 'none';
    elements.editNoteInput.value = '';
}

// 更新密钥备注
async function updateKeyNote(elements) {
    const dialog = elements.editNoteDialog;
    const key = dialog.dataset.key;
    const note = elements.editNoteInput.value.trim();
    
    try {
        const response = await fetch(`/admin/keys/${key}/note`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ note })
        });

        if (!response.ok) throw new Error('更新备注失败');

        const data = await response.json();
        if (data.success) {
            hideEditNoteDialog(elements);
            showMessageDialog(elements, '备注已更新', 'success');
            loadKeys(elements);
        } else {
            showMessageDialog(elements, '更新备注失败：' + data.message, 'error');
        }
    } catch (error) {
        console.error('更新备注错误:', error);
        showMessageDialog(elements, '更新备注失败，请重试', 'error');
    }
}

function renderKeysList(keys, elements) {
    let html = '';
    keys.forEach(key => {
        const isValid = isKeyValid(key);
        const sourceText = getSourceText(key.info.source);
        html += `
        <div class="key-item" data-key="${key.key}">
            <div class="key-main">
                <div class="key-info">
                    <div class="key-text"><strong>密钥：</strong><span class="${isValid ? 'valid-key' : 'invalid-key'}">${key.key}</span></div>
                    <div class="key-text"><strong>来源：</strong>${sourceText}</div>
                    <div class="key-text"><strong>创建：</strong>${formatDate(key.info.createdAt)}</div>
                    <div class="key-text"><strong>过期：</strong>${formatDate(key.info.expiresAt)}</div>
                </div>
                <div class="key-note">
                    <strong>备注：</strong>${key.info.note || '无'}
                </div>
            </div>
            <div class="key-actions">
                <button class="action-button edit-note" title="编辑备注" data-key="${key.key}">编辑</button>
                <button class="action-button copy-key" title="复制密钥" data-key="${key.key}">复制</button>
                <button class="action-button delete-key" title="停用密钥" data-key="${key.key}">停用</button>
            </div>
        </div>
    `;
    });
    elements.keysListContent.innerHTML = html;

    // 添加事件监听器
    elements.keysListContent.querySelectorAll('.copy-key').forEach(button => {
        button.addEventListener('click', () => copyKey(button.dataset.key, elements));
    });

    elements.keysListContent.querySelectorAll('.delete-key').forEach(button => {
        button.addEventListener('click', () => deactivateKey(button.dataset.key, elements));
    });

    elements.keysListContent.querySelectorAll('.edit-note').forEach(button => {
        button.addEventListener('click', () => showEditNoteDialog(elements, button.dataset.key));
    });
}

async function deactivateKey(key, elements) {
    if (!confirm('确定要停用此密钥吗？停用后将无法恢复。')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys/${key}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        if (!response.ok) throw new Error('停用密钥失败');

        const data = await response.json();
        if (data.success) {
            showMessageDialog(elements, '密钥已停用', 'success');
            loadKeys(elements);
        } else {
            showMessageDialog(elements, '停用密钥失败：' + data.message, 'error');
        }
    } catch (error) {
        console.error('停用密钥错误:', error);
        showMessageDialog(elements, '停用密钥失败，请重试', 'error');
    }
}

// 复制文本到剪贴板
async function copyTextToClipboard(text) {
    try {
        // 首先尝试使用 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // 如果 Clipboard API 不可用，使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 将文本框移到视图之外
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        // 选中文本并复制
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            textArea.remove();
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            textArea.remove();
            return false;
        }
    } catch (err) {
        console.error('复制失败:', err);
        return false;
    }
}

async function copyKey(key, elements) {
    const success = await copyTextToClipboard(key);
    if (success) {
        showMessageDialog(elements, '密钥已复制到剪贴板', 'success');
    } else {
        showMessageDialog(elements, '复制密钥失败，请手动复制', 'error');
    }
}

async function copyKeyInfo(elements) {
    const key = elements.createdKeyDisplay.textContent;
    const validity = elements.keyValidityDisplay.textContent;
    const copyText = `API 密钥: ${key}\n有效期: ${validity}`;

    const success = await copyTextToClipboard(copyText);
    if (success) {
        showMessageDialog(elements, '密钥信息已复制到剪贴板', 'success');
    } else {
        showMessageDialog(elements, '复制密钥信息失败，请手动复制', 'error');
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

// 初始化搜索功能
function initSearch(elements) {
    const searchInput = elements.searchInput;
    let searchTimeout;

    // 处理输入事件
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const filteredKeys = filterAndSearchKeys(allKeys, searchInput.value);
            renderKeysList(filteredKeys, elements);
        }, 300);
    });

    // 处理回车键
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const filteredKeys = filterAndSearchKeys(allKeys, searchInput.value);
            renderKeysList(filteredKeys, elements);
        }
    });
}

// Initialize when DOM is loaded
let globalElements;
document.addEventListener('DOMContentLoaded', () => {
    globalElements = initializeApp();
    initSearch(globalElements);
});
