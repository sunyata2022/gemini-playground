import { getApi } from './core.js';
import { showMessageDialog, showConfirmDialog, hideEditDialog } from './ui/dialogs.js';
import { filterAndSearchKeys } from './ui/search.js';
import { formatDate, getRemainingTime } from './utils/date.js';
import { copyToClipboard } from './utils/clipboard.js';

// 存储所有密钥的数组
let allKeys = [];

// 全局函数，用于复制和编辑密钥
window.copyKey = async function(key) {
    if (await copyToClipboard(key)) {
        showMessageDialog(window.keyManagerElements, '复制成功', 'success');
    } else {
        showMessageDialog(window.keyManagerElements, '复制失败，请手动复制', 'error');
    }
};

window.showEditDialog = function(key) {
    const elements = window.keyManagerElements;
    elements.editDialog.dataset.key = key;
    elements.editDialog.style.display = 'flex';
    
    // 找到对应的密钥数据
    const keyData = allKeys.find(k => k.key === key);
    if (keyData) {
        elements.editNote.value = keyData.info.note || '';
        elements.editValidityDays.value = Math.ceil((keyData.info.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    }
};

// 初始化密钥管理模块
export function initKeyManager(elements) {
    // 保存 elements 到全局变量，供复制和编辑函数使用
    window.keyManagerElements = elements;

    const {
        createKeyBtn,
        cancelCreateKey,
        confirmCreateKey,
        copyKeyBtn,
        closeKeyDialog,
        cancelEdit,
        confirmEdit
    } = elements;

    // 创建密钥相关事件
    createKeyBtn?.addEventListener('click', () => showCreateKeyDialog(elements));
    cancelCreateKey?.addEventListener('click', () => hideCreateKeyDialog(elements));
    confirmCreateKey?.addEventListener('click', () => createNewKey(elements));
    copyKeyBtn?.addEventListener('click', () => copyKeyInfo(elements));
    closeKeyDialog?.addEventListener('click', () => hideKeyCreatedDialog(elements));

    // 编辑密钥相关事件
    cancelEdit?.addEventListener('click', () => hideEditDialog(elements));
    confirmEdit?.addEventListener('click', () => updateKey(elements));

    // 监听认证成功事件
    document.addEventListener('auth:success', () => loadKeys(elements));

    // 监听搜索事件
    document.addEventListener('search:changed', (e) => {
        const { query, filter } = e.detail;
        const filteredKeys = filterAndSearchKeys(allKeys, query, filter);
        renderKeysList(filteredKeys, elements);
    });
}

// 创建新密钥
async function createNewKey(elements) {
    const validityDays = parseInt(elements.validityDays.value);
    const note = elements.keyNote.value.trim();

    if (!validityDays || validityDays <= 0) {
        showMessageDialog(elements, '请输入有效的天数', 'error');
        return;
    }

    try {
        const api = getApi();
        const data = await api.createKey(validityDays, note);
        
        if (data.key) {
            hideCreateKeyDialog(elements);
            showKeyCreatedDialog(elements, data.key, validityDays);
            await loadKeys(elements);
        } else {
            showMessageDialog(elements, '创建密钥失败', 'error');
        }
    } catch (error) {
        showMessageDialog(elements, '创建过程中发生错误', 'error');
    }
}

// 加载密钥列表
let isLoadingKeys = false;
async function loadKeys(elements) {
    if (isLoadingKeys) {
        console.log('Already loading keys, skipping...');
        return;
    }

    try {
        isLoadingKeys = true;
        console.log('Loading keys...');
        const api = getApi();
        const data = await api.getKeys();
        
        if (data && data.keys) {
            console.log('Keys loaded:', data.keys);
            allKeys = data.keys;

            // 获取当前选中的过滤器
            let activeFilter = 'active';
            if (elements.filterButtons) {
                const activeButton = Array.from(elements.filterButtons).find(btn => btn.classList.contains('active'));
                if (activeButton) {
                    activeFilter = activeButton.dataset.filter;
                }
            }

            const filteredKeys = filterAndSearchKeys(allKeys, 
                elements.searchInput?.value || '', 
                activeFilter
            );
            console.log('Filtered keys:', filteredKeys);
            renderKeysList(filteredKeys, elements);
        } else {
            console.error('Invalid response format:', data);
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
        showMessageDialog(elements, '加载密钥列表失败', 'error');
    } finally {
        isLoadingKeys = false;
    }
}

// 更新密钥
async function updateKey(elements) {
    const keyToUpdate = elements.editDialog.dataset.key;
    const note = elements.editNote.value.trim();
    const validityDays = parseInt(elements.editValidityDays.value) || 0;

    try {
        const api = getApi();
        const data = await api.updateKey(keyToUpdate, { note, validityDays });
        
        if (data.success) {
            hideEditDialog(elements);
            await loadKeys(elements);
            showMessageDialog(elements, '更新成功', 'success');
        } else {
            showMessageDialog(elements, '更新失败', 'error');
        }
    } catch (error) {
        showMessageDialog(elements, '更新过程中发生错误', 'error');
    }
}

// 渲染密钥列表
function renderKeysList(keys, elements) {
    console.log('Rendering keys:', keys);
    const content = elements.keysListContent;
    if (!content) {
        console.error('Keys list content element not found');
        return;
    }
    content.innerHTML = '';

    if (!Array.isArray(keys)) {
        console.error('Keys is not an array:', keys);
        return;
    }

    keys.forEach(keyData => {
        if (!keyData || !keyData.key || !keyData.info) {
            console.error('Invalid key data:', keyData);
            return;
        }
        const keyElement = createKeyElement(keyData, elements);
        content.appendChild(keyElement);
    });
}

// 创建密钥元素
function createKeyElement(keyData, elements) {
    try {
        if (!keyData || !keyData.key || !keyData.info) {
            console.error('Invalid key data:', keyData);
            return document.createElement('div');
        }

        const { key, info } = keyData;
        const div = document.createElement('div');
        div.className = 'key-item';
        div.innerHTML = `
            <div class="key-main">
                <div class="key-info">
                    <div class="key-text">
                        <strong>密钥：</strong>
                        <span class="${isKeyValid(info) ? 'valid-key' : 'invalid-key'}">${key}</span>
                    </div>
                    <div class="key-text">
                        <strong>创建：</strong>
                        <span>${formatDate(info.createdAt)}</span>
                    </div>
                    <div class="key-text">
                        <strong>过期：</strong>
                        <span>${formatDate(info.expiresAt)}</span>
                        <span class="status-text">${getRemainingTime(info.expiresAt)}</span>
                    </div>
                </div>
                <div class="key-note">
                    <strong>备注：</strong>
                    <span>${info.note || '无'}</span>
                </div>
            </div>
            <div class="key-actions">
                <button class="action-button" onclick="copyKey('${key}')">复制</button>
                <button class="action-button" onclick="showEditDialog('${key}')">编辑</button>
            </div>
        `;
        return div;
    } catch (error) {
        console.error('Error creating key element:', error, keyData);
        return document.createElement('div');
    }
}

// 检查密钥是否有效
function isKeyValid(info) {
    return info.active && info.expiresAt > Date.now();
}

// 对话框显示/隐藏
function showCreateKeyDialog(elements) {
    elements.createKeyDialog.style.display = 'flex';
    elements.validityDays.value = '30';
    elements.keyNote.value = '';
}

function hideCreateKeyDialog(elements) {
    elements.createKeyDialog.style.display = 'none';
}

function showKeyCreatedDialog(elements, key, validity) {
    elements.createdKeyDisplay.textContent = key;
    elements.keyValidityDisplay.textContent = `${validity}天`;
    elements.keyCreatedDialog.style.display = 'flex';
}

function hideKeyCreatedDialog(elements) {
    elements.keyCreatedDialog.style.display = 'none';
}

// 复制密钥
async function copyKeyInfo(elements) {
    const keyText = elements.createdKeyDisplay.textContent;
    if (await copyToClipboard(keyText)) {
        showMessageDialog(elements, '复制成功', 'success');
    } else {
        showMessageDialog(elements, '复制失败，请手动复制', 'error');
    }
}
