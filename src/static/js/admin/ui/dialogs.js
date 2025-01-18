// 对话框管理模块

// 存储回调函数
const callbacks = new Map();

// 显示对话框
export function showDialog(dialogId, options = {}) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) {
        console.error(`Dialog with id ${dialogId} not found`);
        return;
    }

    // 如果有消息，设置消息内容
    if (options.message) {
        const messageElement = dialog.querySelector('#messageText, #confirmText');
        if (messageElement) {
            messageElement.textContent = options.message;
        }
    }

    // 如果有确认回调，存储它
    if (options.onConfirm) {
        callbacks.set(dialogId, options.onConfirm);
    }

    // 显示对话框
    dialog.style.display = 'flex';

    // 绑定关闭事件
    const closeButton = dialog.querySelector('.dialog-close, #confirmMessage, #closeDialog');
    if (closeButton) {
        closeButton.onclick = () => hideDialog(dialogId);
    }

    // 绑定确认和取消按钮
    const confirmButton = dialog.querySelector('#confirmConfirm');
    if (confirmButton) {
        confirmButton.onclick = async () => {
            const callback = callbacks.get(dialogId);
            if (callback) {
                await callback();
                callbacks.delete(dialogId);
            }
            hideDialog(dialogId);
        };
    }

    const cancelButton = dialog.querySelector('#cancelConfirm');
    if (cancelButton) {
        cancelButton.onclick = () => {
            callbacks.delete(dialogId);
            hideDialog(dialogId);
        };
    }
}

// 隐藏对话框
export function hideDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) {
        console.error(`Dialog with id ${dialogId} not found`);
        return;
    }

    dialog.style.display = 'none';
    callbacks.delete(dialogId);
}

// 初始化所有对话框
export function initDialogs() {
    // 为所有对话框添加点击外部关闭功能
    document.querySelectorAll('.dialog-overlay').forEach(dialog => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                e.preventDefault();
                e.stopPropagation();
                // 某些对话框不应该通过点击外部关闭
                if (!dialog.classList.contains('no-click-outside')) {
                    hideDialog(dialog.id);
                }
            }
        });
    });
}
