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

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            // 尝试解析JSON响应
            let data;
            try {
                data = await response.json();
            } catch (e) {
                // 如果响应不是JSON格式，使用状态文本
                data = { error: response.statusText };
            }
            
            if (!response.ok) {
                throw new Error(data.error || `请求失败: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                throw new Error('无法连接到服务器，请检查网络连接');
            }
            throw error;
        }
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

    // 编辑Gemini Key
    async editGeminiKey(key, data) {
        const response = await this.request(`/api/admin/gemini-keys/${key}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        if (!response.success) {
            throw new Error(response.error || '编辑失败');
        }

        return response;
    }

    // 删除Gemini密钥
    async deleteGeminiKey(key) {
        return this.request(`/api/admin/gemini-keys/${key}`, {
            method: 'DELETE'
        });
    }

    // 获取所有兑换码批次
    async getRedeemBatches() {
        return this.request('/api/admin/redeem/batches');
    }

    // 创建兑换码批次
    async createRedeemBatch({ validityDays, count, note }) {
        return this.request('/api/admin/redeem/batch', {
            method: 'POST',
            body: JSON.stringify({ validityDays, count, note })
        });
    }

    // 获取批次中的兑换码
    async getRedeemBatchCodes(batchId) {
        return this.request(`/api/admin/redeem/batch/${batchId}`);
    }

    // 删除兑换码批次
    async deleteRedeemBatch(batchId) {
        return this.request(`/api/admin/redeem/batch/${batchId}`, {
            method: 'DELETE'
        });
    }
}

// 创建并导出默认的API客户端实例
export const api = new ApiClient();
