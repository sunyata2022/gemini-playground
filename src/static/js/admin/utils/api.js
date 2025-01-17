// API Base URL
const API_BASE_URL = '';

// API 请求工具类
export class ApiClient {
    constructor(token) {
        this.token = token;
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = this.token;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return response.json();
    }

    // 验证管理员令牌
    async verifyToken() {
        return this.request('/api/admin/verify', {
            method: 'POST'
        });
    }

    // 获取所有密钥
    async getKeys() {
        return this.request('/api/admin/keys');
    }

    // 创建新密钥
    async createKey(validityDays, note) {
        return this.request('/api/admin/keys', {
            method: 'POST',
            body: JSON.stringify({ validityDays, note })
        });
    }

    // 更新密钥
    async updateKey(key, updates) {
        return this.request(`/api/admin/keys/${key}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }
}
