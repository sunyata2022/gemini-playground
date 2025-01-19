import { api } from './utils/api.js';
import { showDialog, hideDialog } from './ui/dialogs.js';

// 初始化认证模块
export async function initAuth() {
    const authDialog = document.getElementById('authDialog');
    const mainContent = document.getElementById('mainContent');
    const adminToken = document.getElementById('adminToken');
    const confirmAuth = document.getElementById('confirmAuth');

    // Auth related events
    authDialog.addEventListener('click', (e) => {
        if (e.target === authDialog) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    adminToken.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') authenticate();
    });

    confirmAuth.addEventListener('click', () => authenticate());

    // Check if already logged in
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        return await verifyStoredToken();
    } else {
        showAuthDialog();
        // 等待用户验证完成
        return new Promise((resolve) => {
            const handleAuth = async () => {
                const result = await authenticate();
                if (result) {
                    // 移除事件监听器，避免内存泄漏
                    confirmAuth.removeEventListener('click', handleAuth);
                    adminToken.removeEventListener('keypress', handleKeyPress);
                    resolve(true);
                }
            };
            
            const handleKeyPress = async (e) => {
                if (e.key === 'Enter') {
                    const result = await authenticate();
                    if (result) {
                        confirmAuth.removeEventListener('click', handleAuth);
                        adminToken.removeEventListener('keypress', handleKeyPress);
                        resolve(true);
                    }
                }
            };

            confirmAuth.addEventListener('click', handleAuth);
            adminToken.addEventListener('keypress', handleKeyPress);
        });
    }
}

// 验证已存储的 token
async function verifyStoredToken() {
    try {
        const token = sessionStorage.getItem('adminToken');
        api.token = token;
        const data = await api.verifyToken();
        
        if (data.success) {
            hideDialog('authDialog');
            return true;
        } else {
            sessionStorage.removeItem('adminToken');
            showAuthDialog();
            return false;
        }
    } catch (error) {
        sessionStorage.removeItem('adminToken');
        showAuthDialog();
        return false;
    }
}

// 显示认证对话框
function showAuthDialog() {
    showDialog('authDialog');
}

// 认证过程
async function authenticate() {
    const adminToken = document.getElementById('adminToken');
    const token = adminToken.value.trim();
    
    if (!token) {
        showDialog('messageDialog', { message: '请输入管理员令牌' });
        return;
    }

    try {
        api.token = token;
        const data = await api.verifyToken();
        
        if (data.success) {
            sessionStorage.setItem('adminToken', token);
            hideDialog('authDialog');
            return true;
        } else {
            showDialog('messageDialog', { message: '验证失败：无效的管理员令牌' });
            return false;
        }
    } catch (error) {
        console.error('Authentication failed:', error);
        showDialog('messageDialog', { message: '验证失败：' + error.message });
        return false;
    }
}
