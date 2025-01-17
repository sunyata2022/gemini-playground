import { getApi } from './core.js';
import { showMessageDialog } from './ui/dialogs.js';

// 初始化认证模块
export function initAuth(elements) {
    if (!elements.authDialog || !elements.mainContent || !elements.adminToken || !elements.confirmAuth) {
        console.error('Missing required elements for auth module', elements);
        return;
    }

    const { authDialog, mainContent, adminToken, confirmAuth } = elements;

    // Auth related events
    authDialog.addEventListener('click', (e) => {
        if (e.target === authDialog) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    adminToken.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate(elements);
    });

    confirmAuth.addEventListener('click', () => authenticate(elements));

    // Check if already logged in
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        verifyStoredToken(elements);
    } else {
        showAuthDialog(elements);
    }
}

// 验证已存储的 token
async function verifyStoredToken(elements) {
    try {
        const api = getApi();
        const data = await api.verifyToken();
        
        if (data.success) {
            showMainContent(elements);
        } else {
            sessionStorage.removeItem('adminToken');
            showAuthDialog(elements);
        }
    } catch (error) {
        sessionStorage.removeItem('adminToken');
        showAuthDialog(elements);
    }
}

// 显示认证对话框
export function showAuthDialog(elements) {
    elements.authDialog.style.display = 'flex';
    elements.mainContent.style.display = 'none';
    elements.adminToken.value = '';
    elements.adminToken.focus();
}

// 显示主内容
function showMainContent(elements) {
    elements.authDialog.style.display = 'none';
    elements.mainContent.style.display = 'block';
    // Trigger initial key load
    document.dispatchEvent(new CustomEvent('auth:success'));
}

// 认证过程
async function authenticate(elements) {
    const token = elements.adminToken.value.trim();
    if (!token) {
        showMessageDialog(elements, '请输入管理员令牌', 'error');
        return;
    }

    try {
        const api = getApi();
        api.token = token;
        const data = await api.verifyToken();

        if (data.success) {
            sessionStorage.setItem('adminToken', token);
            showMainContent(elements);
        } else {
            showMessageDialog(elements, '管理员令牌无效', 'error');
        }
    } catch (error) {
        showMessageDialog(elements, '验证过程中发生错误', 'error');
    }
}
