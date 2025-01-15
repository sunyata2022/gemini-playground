// Constants
const API_BASE_URL = '';
let ADMIN_TOKEN = localStorage.getItem('adminToken');
let allKeys = [];  // 添加全局变量存储所有密钥

// 存储所有密钥的数组
// let allKeys = [];

// 当前选中的筛选器
let currentFilter = 'active';

// Initialize the application
function initializeApp() {
    // Get DOM elements
    const elements = getElements();

    // Auth related events
    elements.authDialog?.addEventListener('click', () => authenticate(elements));
    elements.adminToken?.addEventListener('keypress', (e) => {
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

    // 编辑对话框事件
    elements.confirmEdit?.addEventListener('click', () => updateKey(elements));
    elements.cancelEdit?.addEventListener('click', () => hideEditDialog(elements));

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
        // 验证对话框元素
        authDialog: document.getElementById('authDialog'),
        adminToken: document.getElementById('adminToken'),
        confirmAuth: document.getElementById('confirmAuth'),

        // 主内容区域
        mainContent: document.getElementById('mainContent'),
        keysListContent: document.getElementById('keysListContent'),
        
        // 创建密钥对话框元素
        createKeyDialog: document.getElementById('createKeyDialog'),
        validityDays: document.getElementById('validityDays'),
        keyNote: document.getElementById('keyNote'),
        confirmCreateKey: document.getElementById('confirmCreateKey'),
        cancelCreateKey: document.getElementById('cancelCreateKey'),

        // 密钥创建成功对话框元素
        keyCreatedDialog: document.getElementById('keyCreatedDialog'),
        createdKeyDisplay: document.getElementById('createdKeyDisplay'),
        keyValidityDisplay: document.getElementById('keyValidityDisplay'),
        copyKeyBtn: document.getElementById('copyKeyBtn'),
        closeKeyDialog: document.getElementById('closeKeyDialog'),

        // 消息对话框元素
        messageDialog: document.getElementById('messageDialog'),
        messageText: document.getElementById('messageText'),
        confirmMessage: document.getElementById('confirmMessage'),

        // 确认对话框元素
        confirmDialog: document.getElementById('confirmDialog'),
        confirmText: document.getElementById('confirmText'),
        confirmConfirm: document.getElementById('confirmConfirm'),
        cancelConfirm: document.getElementById('cancelConfirm'),
        
        // 编辑对话框元素
        editDialog: document.getElementById('editDialog'),
        editNote: document.getElementById('editNoteInput'),  
        editExpiryDays: document.getElementById('editExpiryDays'),
        statusActive: document.getElementById('statusActive'),
        statusInactive: document.getElementById('statusInactive'),
        confirmEdit: document.getElementById('confirmEdit'),
        cancelEdit: document.getElementById('cancelEdit'),
        
        // Tab elements
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // 搜索元素
        searchInput: document.getElementById('searchInput'),
        filterButtons: document.querySelectorAll('.filter-button'),
        
        // 创建按钮
        createKeyBtn: document.getElementById('createKeyBtn'),
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
    elements.adminToken.focus();
}

async function authenticate(elements) {
    const token = elements.adminToken.value.trim();
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

        if (!response.ok) throw new Error('无效的令牌');

        // Store token and initialize
        ADMIN_TOKEN = token;
        localStorage.setItem('adminToken', token);
        elements.authDialog.classList.remove('active');
        elements.mainContent.style.display = 'block';
        elements.adminToken.value = '';
        
        // Initialize the app
        loadKeys(elements);
    } catch (error) {
        console.error('认证错误:', error);
        showMessageDialog(elements, '无效的管理员令牌，请重试', 'error');
        elements.adminToken.value = '';
        elements.adminToken.focus();
    }
}

async function verifyAndInitialize(elements) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/keys`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });

        if (!response.ok) throw new Error('无效的令牌');

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
    elements.validityDays.value = '30';
    elements.keyNote.value = '';
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
    const validityDays = parseInt(elements.validityDays.value);
    const note = elements.keyNote.value;

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
        allKeys = data.keys;  // 更新全局变量
        const filteredKeys = filterAndSearchKeys(allKeys, elements.searchInput.value);
        renderKeysList(filteredKeys, elements);
    } catch (error) {
        console.error('加载密钥错误:', error);
        showMessageDialog(elements, '加载密钥失败，请重试', 'error');
    }
}

// 检查密钥是否有效
function isKeyValid(key) {
    return key.info.active && key.info.expiresAt > Date.now();
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

function getKeyStatus(info) {
    if (!info.active) {
        return { status: 'inactive', text: '已禁用', class: 'inactive-key' };
    }
    const now = Date.now();
    if (now >= info.expiresAt) {
        return { status: 'expired', text: '已过期', class: 'expired-key' };
    }
    return { status: 'valid', text: '有效', class: 'valid-key' };
}

// 显示编辑对话框
function showEditDialog(elements, key) {
    const dialog = elements.editDialog;
    const noteInput = elements.editNote;
    const expiryInput = elements.editExpiryDays;
    const statusActive = elements.statusActive;
    const statusInactive = elements.statusInactive;
    
    // 设置当前密钥的信息
    const keyData = allKeys.find(k => k.key === key);
    if (!keyData) return;

    noteInput.value = keyData.info.note || '';
    expiryInput.value = '0';
    
    // 设置密钥状态
    const now = Date.now();
    const isActive = keyData.info.active && keyData.info.expiresAt > now;
    statusActive.checked = isActive;
    statusInactive.checked = !isActive;
    
    // 存储当前编辑的密钥
    dialog.dataset.key = key;
    dialog.dataset.originalActive = String(isActive);
    
    dialog.classList.add('active');
}

// 隐藏编辑对话框
function hideEditDialog(elements) {
    elements.editDialog.classList.remove('active');
    elements.editNote.value = '';
    elements.editExpiryDays.value = '0';
}

// 更新密钥信息
async function updateKey(elements) {
    const dialog = elements.editDialog;
    const key = dialog.dataset.key;
    const note = elements.editNote.value.trim();
    const expiryDays = parseInt(elements.editExpiryDays.value, 10);
    const newActive = elements.statusActive.checked;
    const originalActive = dialog.dataset.originalActive === 'true';
    
    if (isNaN(expiryDays)) {
        showMessageDialog(elements, '请输入有效的天数', 'error');
        return;
    }
    
    // 始终发送 active 状态，因为它是一个布尔值
    const updates = {
        active: newActive
    };
    
    // 只在有值时添加其他字段
    if (note) {
        updates.note = note;
    }
    if (expiryDays !== 0) {  
        updates.expiryDays = expiryDays;
    }
    
    try {
        const response = await fetch(`/admin/keys/${key}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('adminToken')
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('更新失败');

        const data = await response.json();
        if (data.success) {
            hideEditDialog(elements);
            showMessageDialog(elements, '更新成功', 'success');
            loadKeys(elements);
        } else {
            showMessageDialog(elements, '更新失败：' + data.message, 'error');
        }
    } catch (error) {
        console.error('更新密钥错误:', error);
        showMessageDialog(elements, '更新失败，请重试', 'error');
    }
}

function renderKeysList(keys, elements) {
    const listContent = keys.map(({ key, info }) => {
        const now = Date.now();
        const isExpired = now >= info.expiresAt;
        const isDisabled = !info.active;
        const isInvalid = isExpired || isDisabled;
        const keyClass = isInvalid ? 'invalid-key' : 'valid-key';
        const statusText = isDisabled ? '已禁用' : (isExpired ? '已过期' : '');
        const sourceText = getSourceText(info.source);
        
        return `
        <div class="key-item">
            <div class="key-main">
                <div class="key-info">
                    <div class="key-text">
                        <strong>密钥：</strong>
                        <span class="${keyClass}" style="${isInvalid ? 'text-decoration: line-through; color: red;' : ''}">${key}</span>
                        ${statusText ? `<span class="status-text">${statusText}</span>` : ''}
                    </div>
                    <div class="key-text"><strong>来源：</strong>${sourceText}</div>
                    <div class="key-text"><strong>创建：</strong>${formatDate(info.createdAt)}</div>
                    <div class="key-text"><strong>过期：</strong>${formatDate(info.expiresAt)}</div>
                </div>
                <div class="key-note">
                    <strong>备注：</strong>${info.note || '无'}
                </div>
            </div>
            <div class="key-actions">
                <button class="secondary-button" onclick="showEditDialog(globalElements, '${key}')">
                    <i class="fas fa-edit"></i>
                    编辑
                </button>
                <button class="icon-button" onclick="copyKey('${key}', globalElements)" title="复制密钥">
                    复制
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    elements.keysListContent.innerHTML = listContent || '<div class="no-keys">暂无密钥</div>';
}

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
