// 对话框管理模块
// 初始化对话框模块
export function initDialogs(elements) {
    const { messageDialog, confirmDialog, confirmMessage, confirmConfirm, cancelConfirm } = elements;

    // 消息对话框事件
    confirmMessage?.addEventListener('click', () => hideMessageDialog(elements));

    // 确认对话框事件
    confirmConfirm?.addEventListener('click', () => {
        hideConfirmDialog(elements);
        if (elements.confirmCallback) {
            elements.confirmCallback();
            elements.confirmCallback = null;
        }
    });

    cancelConfirm?.addEventListener('click', () => {
        hideConfirmDialog(elements);
        elements.confirmCallback = null;
    });
}

// 消息对话框
export function showMessageDialog(elements, message, type = 'info') {
    const messageDialog = elements.messageDialog;
    const messageText = elements.messageText;
    
    messageText.textContent = message;
    messageDialog.className = `dialog-overlay message-${type}`;
    messageDialog.style.display = 'flex';
}

export function hideMessageDialog(elements) {
    elements.messageDialog.style.display = 'none';
}

// 确认对话框
export function showConfirmDialog(elements, message, callback) {
    const confirmDialog = elements.confirmDialog;
    const confirmText = elements.confirmText;
    
    confirmText.textContent = message;
    elements.confirmCallback = callback;
    confirmDialog.style.display = 'flex';
}

export function hideConfirmDialog(elements) {
    elements.confirmDialog.style.display = 'none';
}

// 编辑对话框
export function showEditDialog(elements, key) {
    const editDialog = elements.editDialog;
    const editNote = elements.editNote;
    const editValidityDays = elements.editValidityDays;
    
    editDialog.dataset.key = key;
    editNote.value = key.note || '';
    editValidityDays.value = '';
    editDialog.style.display = 'flex';
}

export function hideEditDialog(elements) {
    elements.editDialog.style.display = 'none';
    elements.editDialog.dataset.key = '';
    elements.editNote.value = '';
    elements.editValidityDays.value = '';
}
