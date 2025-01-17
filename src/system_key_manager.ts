interface SystemKeyInfo {
    key: string;          // Gemini API key
    account: string;      // 对应的 Gemini 账号
    errorCount: number;   // 错误计数
    lastErrorAt?: number; // 最后一次错误时间
    note?: string;        // 备注信息
}

export class SystemKeyManager {
    private kv: Deno.Kv;
    private activeKeys: string[] = [];    // 可用的 keys
    private inactiveKeys: string[] = [];  // 不可用的 keys
    private currentIndex: number = 0;
    private readonly KV_ACTIVE_KEYS = ["system_keys", "active"];    // 活跃 key 列表
    private readonly KV_INACTIVE_KEYS = ["system_keys", "inactive"]; // 非活跃 key 列表
    private readonly KV_KEY_INFO = "system_key_info:";              // key 详情
    private initialized = false;

    constructor() {
        this.currentIndex = 0;
    }

    async init() {
        if (this.initialized) return;
        this.kv = await Deno.openKv();
        await this.loadKeys();
        this.initialized = true;
    }

    // 核心方法：获取下一个可用的 key
    async getNextKey(): Promise<string> {
        if (!this.initialized) {
            throw new Error("SystemKeyManager not initialized");
        }

        if (this.activeKeys.length === 0) {
            throw new Error("No active system keys available");
        }

        this.currentIndex = (this.currentIndex + 1) % this.activeKeys.length;
        return this.activeKeys[this.currentIndex];
    }

    // 添加新的 system key
    async addKey(key: string, account: string, note?: string): Promise<void> {
        if (!this.initialized) {
            throw new Error("SystemKeyManager not initialized");
        }

        if (this.activeKeys.includes(key) || this.inactiveKeys.includes(key)) {
            throw new Error("Key already exists");
        }

        const keyInfo: SystemKeyInfo = {
            key,
            account,
            errorCount: 0,
            note
        };

        // 原子操作：更新 active key 列表和 key 信息
        const atomic = this.kv.atomic();
        this.activeKeys.push(key);
        atomic
            .set(this.KV_ACTIVE_KEYS, this.activeKeys)
            .set([this.KV_KEY_INFO, key], keyInfo);
        
        await atomic.commit();
    }

    // 删除 system key
    async removeKey(key: string): Promise<boolean> {
        const activeIndex = this.activeKeys.indexOf(key);
        const inactiveIndex = this.inactiveKeys.indexOf(key);
        
        if (activeIndex === -1 && inactiveIndex === -1) {
            return false;
        }

        // 从相应的列表中删除
        if (activeIndex !== -1) {
            this.activeKeys.splice(activeIndex, 1);
            if (this.currentIndex >= this.activeKeys.length) {
                this.currentIndex = 0;
            }
        } else {
            this.inactiveKeys.splice(inactiveIndex, 1);
        }

        // 原子操作：更新列表并删除 key 信息
        const atomic = this.kv.atomic();
        atomic
            .set(this.KV_ACTIVE_KEYS, this.activeKeys)
            .set(this.KV_INACTIVE_KEYS, this.inactiveKeys)
            .delete([this.KV_KEY_INFO, key]);
        
        await atomic.commit();
        return true;
    }

    // 禁用 key
    async deactivateKey(key: string): Promise<boolean> {
        const activeIndex = this.activeKeys.indexOf(key);
        if (activeIndex === -1) return false;

        // 从 active 移动到 inactive
        this.activeKeys.splice(activeIndex, 1);
        this.inactiveKeys.push(key);

        // 如果当前索引超出范围，重置它
        if (this.currentIndex >= this.activeKeys.length) {
            this.currentIndex = 0;
        }

        // 原子操作：更新两个列表
        const atomic = this.kv.atomic();
        atomic
            .set(this.KV_ACTIVE_KEYS, this.activeKeys)
            .set(this.KV_INACTIVE_KEYS, this.inactiveKeys);
        
        await atomic.commit();
        return true;
    }

    // 启用 key
    async activateKey(key: string): Promise<boolean> {
        const inactiveIndex = this.inactiveKeys.indexOf(key);
        if (inactiveIndex === -1) return false;

        // 从 inactive 移动到 active
        this.inactiveKeys.splice(inactiveIndex, 1);
        this.activeKeys.push(key);

        // 原子操作：更新两个列表
        const atomic = this.kv.atomic();
        atomic
            .set(this.KV_ACTIVE_KEYS, this.activeKeys)
            .set(this.KV_INACTIVE_KEYS, this.inactiveKeys);
        
        await atomic.commit();
        return true;
    }

    // 获取单个 key 的详细信息
    async getKeyInfo(key: string): Promise<SystemKeyInfo | null> {
        const result = await this.kv.get<SystemKeyInfo>([this.KV_KEY_INFO, key]);
        return result.value;
    }

    // 记录错误
    async recordError(key: string): Promise<void> {
        const keyInfo = await this.getKeyInfo(key);
        if (!keyInfo) return;

        keyInfo.errorCount++;
        keyInfo.lastErrorAt = Date.now();
        await this.kv.set([this.KV_KEY_INFO, key], keyInfo);
    }

    // 获取所有 keys 的详细信息
    async listKeys(): Promise<Array<SystemKeyInfo & { status: 'active' | 'inactive' }>> {
        const result: Array<SystemKeyInfo & { status: 'active' | 'inactive' }> = [];
        
        // 获取所有 key 的信息
        for (const key of this.activeKeys) {
            const info = await this.getKeyInfo(key);
            if (info) result.push({ ...info, status: 'active' });
        }
        
        for (const key of this.inactiveKeys) {
            const info = await this.getKeyInfo(key);
            if (info) result.push({ ...info, status: 'inactive' });
        }
        
        return result;
    }

    // 获取错误统计
    async getErrorStats(): Promise<Array<{
        key: string;
        account: string;
        errorCount: number;
        lastErrorAt?: number;
        status: 'active' | 'inactive';
    }>> {
        const allKeys = await this.listKeys();
        return allKeys
            .filter(k => k.errorCount > 0)
            .map(({ key, account, errorCount, lastErrorAt, status }) => ({
                key,
                account,
                errorCount,
                lastErrorAt,
                status
            }))
            .sort((a, b) => b.errorCount - a.errorCount);
    }

    // 从 KV 加载 key 列表到内存
    async loadKeys(): Promise<void> {
        const activeResult = await this.kv.get<string[]>(this.KV_ACTIVE_KEYS);
        const inactiveResult = await this.kv.get<string[]>(this.KV_INACTIVE_KEYS);
        
        this.activeKeys = activeResult.value || [];
        this.inactiveKeys = inactiveResult.value || [];
    }

    // 获取所有系统key的详细信息
    async getAllKeys(): Promise<SystemKeyInfo[]> {
        const allKeys = [...this.activeKeys, ...this.inactiveKeys];
        const keys: SystemKeyInfo[] = [];

        for (const key of allKeys) {
            const keyInfo = await this.kv.get<SystemKeyInfo>([this.KV_KEY_INFO, key]);
            if (keyInfo.value) {
                keys.push(keyInfo.value);
            }
        }

        return keys;
    }
}
