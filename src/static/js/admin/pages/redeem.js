// Redeem Page Module
import { showDialog, hideDialog } from '../ui/dialogs.js';
import { initSearch } from '../ui/search.js';
import { api } from '../utils/api.js';
import { formatDate } from '../utils/date.js';

export class RedeemPage {
    constructor() {
        this.container = document.getElementById('settings');
        this.redeemListContent = document.getElementById('redeemListContent');
        this.searchInput = document.getElementById('searchRedeemInput');
        this.clearSearchBtn = document.getElementById('clearRedeemSearch');
        this.createBatchBtn = document.getElementById('createRedeemBatchBtn');
        
        this.bindEvents();
        this.initializeSearch();
    }

    bindEvents() {
        this.createBatchBtn.addEventListener('click', () => this.showCreateBatchDialog());
        
        // Filter buttons
        // this.container.querySelectorAll('.filter-button').forEach(button => {
        //     button.addEventListener('click', (e) => this.handleFilterClick(e));
        // });

        // 创建批次对话框按钮
        document.getElementById('confirmCreateRedeemBatch').addEventListener('click', () => this.handleCreateBatch());
        document.getElementById('cancelCreateRedeemBatch').addEventListener('click', () => hideDialog('createRedeemBatchDialog'));
    }

    initializeSearch() {
        this.searchInput.addEventListener('input', (e) => {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            const value = e.target.value.trim();
            this.clearSearchBtn.style.display = value ? 'flex' : 'none';
            
            this.searchTimeout = setTimeout(() => {
                this.filterAndRenderBatches(value);
            }, 300);
        });

        this.clearSearchBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.clearSearchBtn.style.display = 'none';
            this.filterAndRenderBatches('');
            this.searchInput.focus();
        });
    }

    async loadBatches() {
        try {
            const response = await api.getRedeemBatches();
            this.batches = response;
            this.filterAndRenderBatches(this.searchInput.value);
        } catch (error) {
            console.error('Failed to load redeem batches:', error);
            showDialog('messageDialog', { message: '加载兑换码批次失败' });
        }
    }

    filterAndRenderBatches(searchValue = '') {
        if (!this.batches) return;

        let filtered = this.batches;

        // 应用搜索过滤
        if (searchValue) {
            const lowerSearch = searchValue.toLowerCase();
            filtered = filtered.filter(batch => 
                batch.batchId.toLowerCase().includes(lowerSearch) ||
                (batch.note && batch.note.toLowerCase().includes(lowerSearch))
            );
        }

        this.renderBatches(filtered);
    }

    renderBatches(batches) {
        if (!batches.length) {
            this.redeemListContent.innerHTML = '<div class="no-keys-message">没有找到兑换码批次</div>';
            return;
        }

        this.redeemListContent.innerHTML = batches.map(batch => this.renderBatchItem(batch)).join('');
        this.bindBatchActions();
    }

    renderBatchItem(batch) {
        return `
            <div class="batch-item" data-batch-id="${batch.batchId}">
                <div class="batch-header">
                    <div class="batch-id">${batch.batchId}</div>
                </div>
                <div class="batch-stats">
                    <span>创建时间: ${formatDate(batch.createdAt)}</span>
                    <span>已使用: ${batch.usedCodes}/${batch.totalCodes}</span>
                    <span>兑换后key有效期: ${batch.validityDays}天</span>
                </div>
                ${batch.note ? `<div class="batch-note">备注: ${batch.note}</div>` : ''}
                <div class="batch-actions">
                    <button class="action-button view" data-action="view">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        查看详情
                    </button>
                    <button class="action-button delete" data-action="delete">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        删除
                    </button>
                </div>
            </div>
        `;
    }

    bindBatchActions() {
        this.redeemListContent.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = button.dataset.action;
                const batchId = button.closest('.batch-item').dataset.batchId;
                
                if (action === 'view') {
                    this.showBatchDetail(batchId);
                } else if (action === 'delete') {
                    this.deleteBatch(batchId);
                }
            });
        });
    }

    // handleFilterClick(e) {
    //     const button = e.target;
    //     const filter = button.dataset.filter;
        
    //     // 更新active状态
    //     this.container.querySelectorAll('.filter-button').forEach(btn => {
    //         btn.classList.toggle('active', btn === button);
    //     });
        
    //     this.currentFilter = filter;
    //     this.filterAndRenderBatches(this.searchInput.value);
    // }

    showCreateBatchDialog() {
        document.getElementById('redeemValidityDays').value = '30';
        document.getElementById('redeemCount').value = '100';
        document.getElementById('redeemNote').value = '';
        showDialog('createRedeemBatchDialog');
    }

    async handleCreateBatch() {
        const validityDays = parseInt(document.getElementById('redeemValidityDays').value);
        const count = parseInt(document.getElementById('redeemCount').value);
        const note = document.getElementById('redeemNote').value.trim();

        if (!validityDays || validityDays <= 0 || !count || count <= 0) {
            showDialog('messageDialog', { message: '请输入有效的天数和数量' });
            return;
        }

        try {
            await api.createRedeemBatch({ validityDays, count, note });
            hideDialog('createRedeemBatchDialog');
            this.loadBatches();
            showDialog('messageDialog', { message: '兑换码批次创建成功' });
        } catch (error) {
            console.error('Failed to create redeem batch:', error);
            showDialog('messageDialog', { message: '创建兑换码批次失败' });
        }
    }

    async showBatchDetail(batchId) {
        try {
            const codes = await api.getRedeemBatchCodes(batchId);
            const batch = this.batches.find(b => b.batchId === batchId);
            
            const dialog = document.getElementById('redeemBatchDetailDialog');
            const batchInfo = dialog.querySelector('.batch-info');
            const codesList = dialog.querySelector('.codes-list');
            
            batchInfo.innerHTML = `
                <div>批次ID: ${batch.batchId}</div>
                <div>创建时间: ${formatDate(batch.createdAt)}</div>
                <div>已使用: ${batch.usedCodes}/${batch.totalCodes}</div>
                ${batch.note ? `<div>备注: ${batch.note}</div>` : ''}
            `;
            
            codesList.innerHTML = codes.map(code => `
                <div class="code-item">
                    <span class="code-value">${code.code}</span>
                    <span class="code-status ${code.isUsed ? 'used' : 'unused'}">
                        ${code.isUsed ? `已使用 (${formatDate(code.usedAt)})` : '未使用'}
                    </span>
                </div>
            `).join('');
            
            showDialog('redeemBatchDetailDialog');
        } catch (error) {
            console.error('Failed to load batch details:', error);
            showDialog('messageDialog', { message: '加载批次详情失败' });
        }
    }

    async deleteBatch(batchId) {
        if (!confirm('确定要删除这个兑换码批次吗？此操作不可撤销。')) {
            return;
        }

        try {
            await api.deleteRedeemBatch(batchId);
            this.loadBatches();
            showDialog('messageDialog', { message: '兑换码批次删除成功' });
        } catch (error) {
            console.error('Failed to delete batch:', error);
            showDialog('messageDialog', { message: '删除兑换码批次失败' });
        }
    }
}

// Export a function to initialize the page
export function initRedeemPage() {
    const page = new RedeemPage();
    page.loadBatches();
    return page;
}
