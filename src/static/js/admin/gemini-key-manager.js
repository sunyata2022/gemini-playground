// Gemini Key管理模块
import { getApi } from './core.js';

class GeminiKeyManager {
    constructor() {
        this.searchInput = document.getElementById('searchGeminiInput');
        this.clearSearchBtn = document.getElementById('clearGeminiSearch');
        this.keysList = document.getElementById('geminiKeysListContent');
        this.addKeyBtn = document.getElementById('createGeminiKeyBtn');
        
        // 添加对话框元素
        this.createDialog = document.getElementById('createGeminiKeyDialog');
        this.geminiKeyInput = document.getElementById('geminiKey');
        this.geminiAccountInput = document.getElementById('geminiAccount');
        this.geminiKeyNoteInput = document.getElementById('geminiKeyNote');
        this.cancelCreateBtn = document.getElementById('cancelCreateGeminiKey');
        this.confirmCreateBtn = document.getElementById('confirmCreateGeminiKey');
        
        // 获取全局元素
        this.elements = {
            messageDialog: document.getElementById('messageDialog'),
            messageText: document.getElementById('messageText'),
            confirmMessage: document.getElementById('confirmMessage')
        };

        this.api = getApi();
        this.initEventListeners();
        this.loadKeys();
    }

    initEventListeners() {
        // 搜索框事件
        this.searchInput.addEventListener('input', () => {
            this.handleSearch();
            this.toggleClearButton();
        });

        this.clearSearchBtn.addEventListener('click', () => {
            this.clearSearch();
        });

        // 添加Key按钮事件
        this.addKeyBtn.addEventListener('click', () => {
            this.showCreateDialog();
        });

        // 添加对话框事件
        this.cancelCreateBtn.addEventListener('click', () => {
            this.hideCreateDialog();
        });

        this.confirmCreateBtn.addEventListener('click', () => {
            this.handleCreateKey();
        });
    }

    toggleClearButton() {
        this.clearSearchBtn.style.display = this.searchInput.value ? 'block' : 'none';
    }

    clearSearch() {
        this.searchInput.value = '';
        this.toggleClearButton();
        this.loadKeys(); // 重新加载所有keys
    }

    handleSearch() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const keys = Array.from(this.keysList.children);
        
        keys.forEach(keyElement => {
            const keyText = keyElement.textContent.toLowerCase();
            const shouldShow = keyText.includes(searchTerm);
            keyElement.style.display = shouldShow ? 'block' : 'none';
        });
    }

    async loadKeys() {
        try {
            const keys = await this.api.getGeminiKeys();
            this.renderKeys(keys);
        } catch (error) {
            console.error('Error loading Gemini keys:', error);
            this.showMessage('加载Gemini keys失败', 'error');
        }
    }

    renderKeys(keys) {
        this.keysList.innerHTML = '';
        
        if (keys.length === 0) {
            this.keysList.innerHTML = '<div class="no-keys">暂无Gemini Keys</div>';
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

            editBtn.addEventListener('click', () => this.editKey(key));
            deleteBtn.addEventListener('click', () => this.deleteKey(key));

            this.keysList.appendChild(keyElement);
        });
    }

    editKey(key) {
        // TODO: 实现编辑功能
    }

    async deleteKey(key) {
        // TODO: 实现删除功能
    }

    showCreateDialog() {
        // 清空输入框
        this.geminiKeyInput.value = '';
        this.geminiAccountInput.value = '';
        this.geminiKeyNoteInput.value = '';
        
        // 显示对话框
        this.createDialog.style.display = 'flex';
    }

    hideCreateDialog() {
        this.createDialog.style.display = 'none';
    }

    showMessage(message, type = 'info') {
        const messageText = this.elements.messageText;
        const messageDialog = this.elements.messageDialog;
        
        messageText.textContent = message;
        messageDialog.className = `dialog-overlay message-${type}`;
        messageDialog.style.display = 'flex';

        // 自动关闭
        setTimeout(() => {
            messageDialog.style.display = 'none';
        }, 3000);
    }

    async handleCreateKey() {
        const key = this.geminiKeyInput.value.trim();
        const account = this.geminiAccountInput.value.trim();
        const note = this.geminiKeyNoteInput.value.trim();

        if (!key) {
            this.showMessage('请输入Gemini Key', 'error');
            return;
        }

        if (!account) {
            this.showMessage('请输入账号', 'error');
            return;
        }

        try {
            await this.api.addGeminiKey(key, account, note);
            this.showMessage('添加Gemini Key成功');
            this.hideCreateDialog();
            this.loadKeys(); // 重新加载列表
        } catch (error) {
            console.error('Error adding Gemini key:', error);
            this.showMessage('添加Gemini Key失败', 'error');
        }
    }
}

// 导出模块
export default GeminiKeyManager;
