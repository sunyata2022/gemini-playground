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
            // 如果 token 已经有 Bearer 前缀就直接用，否则添加前缀
            headers['Authorization'] = this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            // 如果服务器返回了错误信息，使用服务器的错误信息
            if (data && data.error) {
                throw new Error(data.error);
            }
            // 否则使用默认的错误信息
            throw new Error(`请求失败: ${response.statusText}`);
        }

        return data;
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

    // 创建新的密钥
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

    // 删除用户Key
    async deleteKey(key) {
        return this.request('/api/admin/keys/' + key, {
            method: 'DELETE'
        });
    }

    // 获取所有Gemini密钥
    async getGeminiKeys() {
        return this.request('/api/admin/gemini-keys');
    }

    // 添加Gemini密钥
    async addGeminiKey(key, account, note) {
        return this.request('/api/admin/gemini-keys', {
            method: 'POST',
            body: JSON.stringify({ key, account, note })
        });
    }

    // 删除Gemini密钥
    async deleteGeminiKey(key) {
        return this.request(`/api/admin/gemini-keys/${key}`, {
            method: 'DELETE'
        });
    }
}

// 创建并导出默认的API客户端实例
export const api = new ApiClient();
