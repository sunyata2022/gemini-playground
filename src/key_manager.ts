import { customAlphabet } from "https://deno.land/x/nanoid/mod.ts";

// 密钥来源枚举
export enum KeySource {
    ADMIN_MANUAL = 'admin_manual',     // 管理员手动创建
    ADMIN_API = 'admin_api',           // 管理员通过 API 创建
    CODE_EXCHANGE = 'code_exchange'     // 激活码兑换
}

interface KeyInfo {
    createdAt: number;
    expiresAt: number;
    active: boolean;
    source: KeySource;
    note?: string;
}

const KV_KEY_PREFIX = "api_key:";
const KEY_LENGTH = 39; // 修改为39位，与 Gemini key 长度一致

export class KeyManager {
    private kv: Deno.Kv;

    async init() {
        this.kv = await Deno.openKv();
    }

    private generateKey(): string {
        // 使用与原来相同的字符集，保持兼容性
        const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', KEY_LENGTH);
        return nanoid();
    }

    async createKey(validityDays: number, source: KeySource = KeySource.ADMIN_MANUAL, note?: string): Promise<string> {
        const newKey = this.generateKey();
        const now = Date.now();
        
        const keyInfo: KeyInfo = {
            createdAt: now,
            expiresAt: now + (validityDays * 24 * 60 * 60 * 1000),
            active: true,
            source,
            note
        };

        // 存储到 KV
        await this.kv.set([KV_KEY_PREFIX, newKey], keyInfo);
        
        return newKey;
    }

    async validateKey(key: string): Promise<boolean> {
        const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
        
        if (!keyInfo.value) {
            return false;
        }

        const now = Date.now();
        return keyInfo.value.active && now < keyInfo.value.expiresAt;
    }

    async updateKeyNote(key: string, note: string): Promise<boolean> {
        const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
        
        if (!keyInfo.value) {
            return false;
        }

        const updatedInfo: KeyInfo = {
            ...keyInfo.value,
            note
        };

        await this.kv.set([KV_KEY_PREFIX, key], updatedInfo);
        return true;
    }

    async updateKey(key: string, updates: { note?: string; expiryDays?: number; active?: boolean }): Promise<boolean> {
        const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
        
        if (!keyInfo.value) {
            return false;
        }

        const updatedInfo: KeyInfo = {
            ...keyInfo.value
        };

        // 分别处理每个可能的更新
        if (updates.note !== undefined) {
            updatedInfo.note = updates.note;
        }
        if (updates.active !== undefined) {
            updatedInfo.active = updates.active;
        }
        if (updates.expiryDays !== undefined) {
            // 支持负数，减少天数
            const daysInMs = updates.expiryDays * 24 * 60 * 60 * 1000;
            updatedInfo.expiresAt = keyInfo.value.expiresAt + daysInMs;
            
            // 确保过期时间不会小于当前时间
            if (updatedInfo.expiresAt < updatedInfo.createdAt) {
                updatedInfo.expiresAt = updatedInfo.createdAt;
            }
        }

        await this.kv.set([KV_KEY_PREFIX, key], updatedInfo);
        return true;
    }

    async listKeys(): Promise<Array<{ key: string; info: KeyInfo }>> {
        const keys: Array<{ key: string; info: KeyInfo }> = [];
        const iter = this.kv.list<KeyInfo>({ prefix: [KV_KEY_PREFIX] });
        
        for await (const entry of iter) {
            const key = entry.key[1] as string;
            keys.push({ key, info: entry.value });
        }
        
        return keys;
    }

    async deleteKey(key: string): Promise<boolean> {
        const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
        
        if (!keyInfo.value) {
            return false;
        }

        await this.kv.delete([KV_KEY_PREFIX, key]);
        return true;
    }
}
