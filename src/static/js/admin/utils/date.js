// 格式化日期
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 计算剩余时间
export function getRemainingTime(expiresAt) {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
        return '已过期';
    }

    const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
    return `${days}天`;
}

// 获取剩余时间状态
export function getRemainingTimeStatus(expiresAt) {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
        return 'expired';
    }

    const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));
    return days > 3 ? 'normal' : 'warning';
}
