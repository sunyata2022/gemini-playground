// User Keys Page Module
import { showDialog, hideDialog } from '../ui/dialogs.js';
import { initSearch } from '../ui/search.js';
import { api } from '../utils/api.js';
import { formatDate } from '../utils/date.js';

export class UserKeysPage {
    constructor() {
        this.container = document.getElementById('keys');
        this.keysListContent = document.getElementById('keysListContent');
        this.searchInput = document.getElementById('searchInput');
        this.clearSearchBtn = document.getElementById('clearSearch');
        this.createKeyBtn = document.getElementById('createKeyBtn');
        this.currentFilter = 'active'; // 添加当前筛选条件的跟踪
        
        this.bindEvents();
        this.initializeSearch();
        
        // 监听tab切换事件
        document.addEventListener('tab:changed', (e) => {
            if (e.detail.tabId === 'keys') {
                this.loadKeys();
            }
        });
    }

    bindEvents() {
        this.createKeyBtn.addEventListener('click', () => this.showCreateKeyDialog());
        
        // Filter buttons
        this.container.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', (e) => this.handleFilterClick(e));
        });

        // 绑定创建Key对话框的确认和取消按钮
        document.getElementById('confirmCreateKey').addEventListener('click', () => this.handleCreateKey());
        document.getElementById('cancelCreateKey').addEventListener('click', () => hideDialog('createKeyDialog'));

        // 绑定对话框关闭按钮
        document.querySelectorAll('.close-dialog').forEach(button => {
            button.addEventListener('click', (e) => {
                const dialogId = e.target.dataset.dialog;
                if (dialogId) {
                    hideDialog(dialogId);
                }
            });
        });
    }

    initializeSearch() {
        // 监听搜索输入
        this.searchInput.addEventListener('input', (e) => {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            const value = e.target.value.trim();
            this.clearSearchBtn.style.display = value ? 'flex' : 'none';
            
            this.searchTimeout = setTimeout(() => {
                this.filterAndRenderKeys(value);
            }, 300);
        });

        // 清除搜索
        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearSearchBtn.style.display = 'none';
            this.filterAndRenderKeys('');
            this.searchInput.focus();
        });
    }

    async loadKeys() {
        try {
            const response = await api.getKeys();
            this.keys = response.keys.map(item => ({
                key: item.key,
                ...item.info,
            }));
            this.filterAndRenderKeys(this.searchInput.value);
        } catch (error) {
            console.error('Failed to load keys:', error);
            showDialog('messageDialog', { message: '加载用户Key失败' });
        }
    }

    renderKeys(keys) {
        this.keysListContent.innerHTML = keys.map(key => this.renderKeyItem(key)).join('');
        this.bindKeyActions();
    }

    renderKeyItem(key) {
        const status = this.getKeyStatus(key);
        return `
            <div class="key-item" data-key="${key.key}">
                <div class="key-header">
                    <div class="key-info">
                        <div class="key-value-container">
                            <div class="key-value">${key.key}</div>
                            <span class="status-badge ${status.type}">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${status.icon}
                                </svg>
                                ${status.text}
                            </span>
                            <div class="key-actions-container">
                                <div class="copy-icon-container">
                                    <svg class="action-icon copy-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    <div class="copy-tooltip">已复制</div>
                                </div>
                                <svg class="action-icon edit-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                <svg class="action-icon delete-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="key-meta">
                            <span>
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                创建时间: ${formatDate(key.createdAt)}
                            </span>
                            <span>
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                过期时间: ${formatDate(key.expiresAt)}
                            </span>
                            ${key.note ? `
                                <span class="note-text">
                                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg>
                                    备注: ${key.note}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getKeyStatus(key) {
        if (!key.active) {
            return {
                type: 'disabled',
                icon: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
                text: '已禁用'
            };
        }
        if (key.expiresAt <= Date.now()) {
            return {
                type: 'expired',
                icon: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
                text: '已过期'
            };
        }
        return {
            type: 'valid',
            icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            text: '有效'
        };
    }

    // 通用的复制文本函数
    async copyToClipboard(text, tooltip) {
        try {
            // 优先使用 navigator.clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // 降级方案：使用 textarea
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            // 显示tooltip
            if (tooltip) {
                tooltip.style.display = 'block';
                setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    }

    bindKeyActions() {
        // 绑定复制按钮
        this.container.querySelectorAll('.copy-icon-container').forEach(container => {
            container.addEventListener('click', (e) => {
                const keyItem = container.closest('.key-item');
                if (keyItem) {
                    const key = keyItem.dataset.key;
                    const tooltip = container.querySelector('.copy-tooltip');
                    this.copyToClipboard(key, tooltip);
                }
            });
        });

        // 绑定编辑按钮
        this.container.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.key-item');
                if (keyItem) {
                    const key = keyItem.dataset.key;
                    this.showEditKeyDialog(key);
                }
            });
        });

        // 绑定删除按钮
        this.container.querySelectorAll('.delete-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.key-item');
                if (keyItem) {
                    const key = keyItem.dataset.key;
                    this.showDeleteConfirmDialog(key);
                }
            });
        });
    }

    handleFilterClick(e) {
        const button = e.target;
        this.currentFilter = button.dataset.filter;
        
        // Update active state
        this.container.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.toggle('active', btn === button);
        });

        // Apply filter
        this.filterAndRenderKeys(this.searchInput.value);
    }

    filterAndRenderKeys(query) {
        if (!this.keys) return;

        let filteredKeys = this.keys;

        // Apply search filter
        if (query) {
            const lowercaseQuery = query.toLowerCase();
            filteredKeys = filteredKeys.filter(key => 
                key.key.toLowerCase().includes(lowercaseQuery) ||
                (key.note && key.note.toLowerCase().includes(lowercaseQuery))
            );
        }

        // Apply status filter
        if (this.currentFilter !== 'all') {
            filteredKeys = filteredKeys.filter(key => {
                const status = this.getKeyStatus(key);
                switch (this.currentFilter) {
                    case 'active':
                        return status.type === 'valid';
                    case 'disabled':
                        return status.type === 'disabled';
                    case 'expired':
                        return status.type === 'expired';
                    default:
                        return true;
                }
            });
        }

        this.renderKeys(filteredKeys);
    }

    showCreateKeyDialog() {
        // Reset form
        document.getElementById('validityDays').value = '30';
        document.getElementById('keyNote').value = '';
        showDialog('createKeyDialog');
    }

    async handleCreateKey() {
        const validityDays = parseInt(document.getElementById('validityDays').value);
        const note = document.getElementById('keyNote').value;

        if (!validityDays || validityDays <= 0) {
            showDialog('messageDialog', { message: '请输入有效的天数' });
            return;
        }

        try {
            const result = await api.createKey(validityDays, note);
            hideDialog('createKeyDialog');
            
            // 显示创建成功对话框
            document.getElementById('createdKeyDisplay').textContent = result.key;
            document.getElementById('keyValidityDisplay').textContent = validityDays;
            
            // 绑定复制功能
            const copyIcon = document.querySelector('#keyCreatedDialog .copy-icon');
            const copyTooltip = document.querySelector('#keyCreatedDialog .copy-tooltip');
            
            copyIcon.addEventListener('click', () => {
                this.copyToClipboard(result.key, copyTooltip);
            });

            showDialog('keyCreatedDialog');
            
            // 重新加载列表
            await this.loadKeys();
        } catch (error) {
            console.error('Failed to create key:', error);
            showDialog('messageDialog', { message: '创建失败：' + error.message });
        }
    }

    showEditKeyDialog(key) {
        const keyInfo = this.keys.find(k => k.key === key);
        if (!keyInfo) return;

        // Set form values
        document.getElementById('editNoteInput').value = keyInfo.note || '';
        document.getElementById('editExpiryDays').value = '0';
        document.getElementById('statusActive').checked = keyInfo.active;
        document.getElementById('statusInactive').checked = !keyInfo.active;

        // 绑定按钮事件
        const confirmEdit = document.getElementById('confirmEdit');
        const cancelEdit = document.getElementById('cancelEdit');
        
        // 移除旧的事件监听器
        const newConfirmEdit = confirmEdit.cloneNode(true);
        const newCancelEdit = cancelEdit.cloneNode(true);
        confirmEdit.parentNode.replaceChild(newConfirmEdit, confirmEdit);
        cancelEdit.parentNode.replaceChild(newCancelEdit, cancelEdit);
        
        // 添加新的事件监听器
        newConfirmEdit.addEventListener('click', () => this.handleEditKey(key));
        newCancelEdit.addEventListener('click', () => hideDialog('editDialog'));

        // Show dialog
        showDialog('editDialog');
    }

    async handleEditKey(key) {
        const note = document.getElementById('editNoteInput').value;
        const expiryDays = parseInt(document.getElementById('editExpiryDays').value);
        const active = document.getElementById('statusActive').checked;

        try {
            await api.updateKey(key, { note, expiryDays, active });
            hideDialog('editDialog');
            showDialog('messageDialog', { message: '更新成功' });
            await this.loadKeys();
        } catch (error) {
            console.error('Failed to update key:', error);
            showDialog('messageDialog', { message: '更新失败：' + error.message });
        }
    }

    showDeleteConfirmDialog(key) {
        // 保存要删除的key
        this.keyToDelete = key;
        
        // 清除之前的错误信息
        const errorMessage = document.getElementById('deleteErrorMessage');
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        showDialog('deleteConfirmDialog');

        // 绑定删除按钮事件
        const confirmButton = document.getElementById('confirmDelete');
        confirmButton.onclick = () => this.handleDeleteKey();

        // 绑定取消按钮事件
        const cancelButton = document.getElementById('cancelDelete');
        cancelButton.onclick = () => hideDialog('deleteConfirmDialog');
    }

    async handleDeleteKey() {
        if (!this.keyToDelete) return;

        try {
            await api.deleteKey(this.keyToDelete);
            hideDialog('deleteConfirmDialog');
            await this.loadKeys();
        } catch (error) {
            console.error('Failed to delete key:', error);
            // 显示错误信息
            const errorMessage = document.getElementById('deleteErrorMessage');
            errorMessage.textContent = '删除失败：' + (error.message || '未知错误');
            errorMessage.style.display = 'block';
        } finally {
            this.keyToDelete = null;
        }
    }
}

// Export a function to initialize the page
export function initUserKeysPage() {
    const page = new UserKeysPage();
    return page;
}
