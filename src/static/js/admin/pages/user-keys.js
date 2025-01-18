// User Keys Page Module
import { showDialog, hideDialog } from '../ui/dialogs.js';
import { initSearch } from '../ui/search.js';
import { api } from '../utils/api.js';
import { formatDate } from '../utils/date.js';
import { copyToClipboard } from '../utils/clipboard.js';

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

        // 绑定Key创建成功对话框的按钮
        document.getElementById('copyKeyBtn').addEventListener('click', () => {
            const key = document.getElementById('createdKeyDisplay').textContent;
            copyToClipboard(key);
            showDialog('messageDialog', { message: '已复制到剪贴板' });
        });
        document.getElementById('closeKeyDialog').addEventListener('click', () => hideDialog('keyCreatedDialog'));
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
        return `
            <div class="key-item" data-key="${key.key}">
                <div class="key-header">
                    <div class="key-info">
                        <div class="key-value-container">
                            <div class="key-value">${key.key}</div>
                            <span class="status-badge ${key.active ? 'active' : 'inactive'}">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${key.active 
                                        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                                        : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'}
                                </svg>
                                ${key.active ? '有效' : '已失效'}
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
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
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

    bindKeyActions() {
        // Bind copy icons
        this.container.querySelectorAll('.copy-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.key-item');
                const key = keyItem.dataset.key;
                copyToClipboard(key);
                
                // Show tooltip
                const tooltip = icon.closest('.copy-icon-container').querySelector('.copy-tooltip');
                tooltip.classList.add('show');
                
                // Remove show class after animation
                setTimeout(() => {
                    tooltip.classList.remove('show');
                }, 1500);
            });
        });

        // Bind edit icons
        this.container.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.key-item');
                const key = keyItem.dataset.key;
                this.showEditKeyDialog(key);
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
            filteredKeys = filteredKeys.filter(key => 
                this.currentFilter === 'active' ? key.active : !key.active
            );
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
            document.getElementById('keyValidityDisplay').textContent = 
                `${validityDays}天 (到期时间: ${formatDate(result.expiresAt)})`;
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
}

// Export a function to initialize the page
export function initUserKeysPage() {
    const page = new UserKeysPage();
    page.loadKeys();
    return page;
}
