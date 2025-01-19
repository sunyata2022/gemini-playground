// Gemini Keys Page Module
import { showDialog, hideDialog } from '../ui/dialogs.js';
import { initSearch } from '../ui/search.js';
import { api } from '../utils/api.js';
import { formatDate } from '../utils/date.js';

export class GeminiKeysPage {
    constructor() {
        this.container = document.getElementById('gemini');
        this.keysListContent = document.getElementById('geminiKeysListContent');
        this.searchInput = document.getElementById('searchGeminiInput');
        this.clearSearchBtn = document.getElementById('clearGeminiSearch');
        this.createKeyBtn = document.getElementById('createGeminiKeyBtn');
        this.currentFilter = 'active'; // 设置初始筛选条件
        
        this.bindEvents();
        this.initializeSearch();
        
        // 监听tab切换事件
        document.addEventListener('tab:changed', (e) => {
            if (e.detail.tabId === 'gemini') {
                this.loadKeys();
            }
        });
    }

    bindEvents() {
        this.createKeyBtn.addEventListener('click', () => this.showCreateKeyDialog());
        
        // Filter buttons
        this.container.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const button = e.target;
                this.currentFilter = button.dataset.filter;
                
                // Update active state
                this.container.querySelectorAll('.filter-button').forEach(btn => {
                    btn.classList.toggle('active', btn === button);
                });

                // Apply filter
                this.filterAndRenderKeys(this.searchInput.value);
            });
        });

        // 绑定创建Gemini Key对话框的确认和取消按钮
        document.getElementById('confirmCreateGeminiKey').addEventListener('click', () => this.handleCreateKey());
        document.getElementById('cancelCreateGeminiKey').addEventListener('click', () => hideDialog('createGeminiKeyDialog'));

        // 编辑对话框的确认和取消按钮
        document.getElementById('confirmEditGeminiKey').addEventListener('click', () => this.handleEditKey());
        document.getElementById('cancelEditGeminiKey').addEventListener('click', () => {
            hideDialog('editGeminiKeyDialog');
            // 清除错误消息
            const errorMessage = document.getElementById('editGeminiKeyErrorMessage');
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
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
            const response = await api.getGeminiKeys();
            // 分别存储active和inactive的keys
            this.activeKeys = response.active || [];
            this.inactiveKeys = response.inactive || [];
            // 合并所有keys用于搜索
            this.keys = [...this.activeKeys, ...this.inactiveKeys];
            this.filterAndRenderKeys(this.searchInput.value);  
        } catch (error) {
            console.error('Failed to load Gemini keys:', error);
            showDialog('messageDialog', { message: '加载Gemini Key失败' });
        }
    }

    renderKeys(keys) {
        this.keysListContent.innerHTML = keys.map(key => this.renderKeyItem(key)).join('');
        this.bindKeyActions();
    }

    renderKeyItem(key) {
        // 根据key是否在activeKeys数组中来判断状态
        const isActive = this.activeKeys.some(k => k.key === key.key);
        return `
            <div class="gemini-key-item" data-key="${key.key}">
                <div class="key-header">
                    <div class="key-info">
                        <div class="key-value-container">
                            <div class="key-value">${key.key}</div>
                            <span class="status-badge ${isActive ? 'active' : 'inactive'}">
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${isActive 
                                        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                                        : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'}
                                </svg>
                                ${isActive ? '有效' : '已失效'}
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
                                <svg class="action-icon delete-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d93025" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="account-info">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            账号: ${key.account}
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
                                更新时间: ${formatDate(key.updatedAt)}
                            </span>
                            <span>
                                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10 16l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                错误次数: ${key.errorCount}
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
                            ${key.lastErrorAt ? `
                                <span class="error-text">
                                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    最后错误时间: ${formatDate(key.lastErrorAt)}
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
        this.container.querySelectorAll('.copy-icon-container').forEach(container => {
            container.addEventListener('click', (e) => {
                const keyItem = container.closest('.gemini-key-item');
                const key = keyItem.dataset.key;
                const tooltip = container.querySelector('.copy-tooltip');
                this.copyToClipboard(key, tooltip);
            });
        });

        // 编辑按钮
        this.container.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.gemini-key-item');
                const key = keyItem.dataset.key;
                this.showEditDialog(key);
            });
        });

        // Bind delete icons
        this.container.querySelectorAll('.delete-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const keyItem = e.target.closest('.gemini-key-item');
                const key = keyItem.dataset.key;
                this.showDeleteConfirmDialog(key);
            });
        });
    }

    filterAndRenderKeys(query) {
        if (!this.activeKeys || !this.inactiveKeys) return;

        let keysToShow = [];
        if (this.currentFilter === 'active') {
            keysToShow = this.activeKeys;
        } else if (this.currentFilter === 'inactive') {
            keysToShow = this.inactiveKeys;
        }

        // 应用搜索过滤
        if (query) {
            const lowercaseQuery = query.toLowerCase();
            keysToShow = keysToShow.filter(key => 
                key.key.toLowerCase().includes(lowercaseQuery) ||
                (key.account && key.account.toLowerCase().includes(lowercaseQuery)) ||
                (key.note && key.note.toLowerCase().includes(lowercaseQuery))
            );
        }

        this.renderKeys(keysToShow);
    }

    showCreateKeyDialog() {
        // Reset form
        document.getElementById('geminiKey').value = '';
        document.getElementById('geminiAccount').value = '';
        document.getElementById('geminiKeyNote').value = '';
        document.getElementById('geminiKeyErrorMessage').style.display = 'none';
        
        showDialog('createGeminiKeyDialog');
    }

    async handleCreateKey() {
        const key = document.getElementById('geminiKey').value.trim();
        const account = document.getElementById('geminiAccount').value.trim();
        const note = document.getElementById('geminiKeyNote').value.trim();
        const errorMessage = document.getElementById('geminiKeyErrorMessage');

        // 验证输入
        if (!key || !account) {
            errorMessage.textContent = 'Gemini Key和账号不能为空';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            await api.addGeminiKey(key, account, note);
            hideDialog('createGeminiKeyDialog');
            showDialog('messageDialog', { message: '添加成功' });
            await this.loadKeys();
        } catch (error) {
            console.error('Failed to add Gemini key:', error);
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        }
    }

    showEditDialog(key) {
        // 在两个数组中查找key
        const keyInfo = this.activeKeys.find(k => k.key === key) || this.inactiveKeys.find(k => k.key === key);
        if (!keyInfo) return;

        // 填充表单数据
        document.getElementById('editGeminiAccount').value = keyInfo.account || '';
        document.getElementById('editGeminiKeyNote').value = keyInfo.note || '';
        
        // 设置状态单选按钮
        const status = this.activeKeys.some(k => k.key === key) ? 'active' : 'inactive';
        document.querySelector(`input[name="editGeminiKeyStatus"][value="${status}"]`).checked = true;
        
        // 存储当前编辑的key
        this.editingKey = key;
        
        // 显示对话框
        showDialog('editGeminiKeyDialog');
    }

    async handleEditKey() {
        try {
            const account = document.getElementById('editGeminiAccount').value.trim();
            const note = document.getElementById('editGeminiKeyNote').value.trim();
            const status = document.querySelector('input[name="editGeminiKeyStatus"]:checked').value;

            if (!account) {
                throw new Error('账号不能为空');
            }

            // 发送编辑请求
            await api.editGeminiKey(this.editingKey, {
                account,
                note,
                status
            });

            // 隐藏对话框
            hideDialog('editGeminiKeyDialog');

            // 清除错误消息
            const errorMessage = document.getElementById('editGeminiKeyErrorMessage');
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';

            // 重新加载列表
            await this.loadKeys();

        } catch (error) {
            // 显示错误消息
            const errorMessage = document.getElementById('editGeminiKeyErrorMessage');
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        }
    }

    showDeleteConfirmDialog(key) {
        const keyInfo = this.keys.find(k => k.key === key);
        if (!keyInfo) return;

        const confirmDialog = document.getElementById('confirmDialog');
        const messageContent = confirmDialog.querySelector('.message-content');
        const confirmText = messageContent.querySelector('#confirmText');
        
        // 确保错误消息元素存在
        let errorMessage = messageContent.querySelector('.error-message');
        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.style.cssText = 'color: #d93025; margin-top: 10px; display: none;';
            messageContent.appendChild(errorMessage);
        }

        // 重置错误消息
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        // 设置确认消息
        confirmText.textContent = `确定要删除账号 ${keyInfo.account} 的Gemini Key吗？`;

        // 绑定确认按钮事件
        const confirmButton = confirmDialog.querySelector('#confirmConfirm');
        confirmButton.onclick = async () => {
            try {
                await api.deleteGeminiKey(key);
                confirmDialog.style.display = 'none';
                await this.loadKeys();
            } catch (error) {
                console.error('Failed to delete Gemini key:', error);
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            }
        };

        // 绑定取消按钮事件
        const cancelButton = confirmDialog.querySelector('#cancelConfirm');
        cancelButton.onclick = () => {
            confirmDialog.style.display = 'none';
        };

        // 显示对话框
        confirmDialog.style.display = 'flex';
    }

    async handleDeleteKey(key) {
        try {
            await api.deleteGeminiKey(key);
            hideDialog('confirmDialog');
            await this.loadKeys();
        } catch (error) {
            console.error('Failed to delete Gemini key:', error);
            showDialog('messageDialog', { message: '删除失败：' + error.message });
        }
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
                tooltip.classList.add('show');
                setTimeout(() => {
                    tooltip.classList.remove('show');
                }, 1500);
            }
        } catch (error) {
            console.error('Failed to copy text:', error);
        }
    }
}

// Export a function to initialize the page
export function initGeminiKeysPage() {
    const page = new GeminiKeysPage();
    return page;
}
