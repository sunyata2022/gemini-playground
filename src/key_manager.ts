import { crypto } from "https://deno.land/std/crypto/mod.ts";

interface KeyInfo {
  createdAt: number;
  expiresAt: number;
  active: boolean;
}

const KV_KEY_PREFIX = "api_key:";
const KEY_LENGTH = 39; // 修改为39位，与 Gemini key 长度一致

export class KeyManager {
  private kv: Deno.Kv;
  private systemKey: string;

  constructor(systemKey: string) {
    this.systemKey = systemKey;
  }

  async init() {
    this.kv = await Deno.openKv();
  }

  private generateKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(KEY_LENGTH);
    crypto.getRandomValues(randomValues);
    
    let result = '';
    for (let i = 0; i < KEY_LENGTH; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    
    return result;
  }

  async createKey(validityDays: number): Promise<string> {
    const newKey = this.generateKey();
    const now = Date.now();
    
    const keyInfo: KeyInfo = {
      createdAt: now,
      expiresAt: now + (validityDays * 24 * 60 * 60 * 1000),
      active: true,
    };

    // 存储到 KV
    await this.kv.set([KV_KEY_PREFIX, newKey], keyInfo);
    
    return newKey;
  }

  async validateKey(key: string): Promise<boolean> {
    // 如果是系统key，直接返回true
    if (key === this.systemKey) {
      return true;
    }

    const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
    
    if (!keyInfo.value) {
      return false;
    }

    const now = Date.now();
    return keyInfo.value.active && now < keyInfo.value.expiresAt;
  }

  async deactivateKey(key: string): Promise<boolean> {
    const keyInfo = await this.kv.get<KeyInfo>([KV_KEY_PREFIX, key]);
    
    if (!keyInfo.value) {
      return false;
    }

    const updatedInfo: KeyInfo = {
      ...keyInfo.value,
      active: false,
    };

    await this.kv.set([KV_KEY_PREFIX, key], updatedInfo);
    return true;
  }

  async listKeys(): Promise<Array<{ key: string; info: KeyInfo }>> {
    const keys: Array<{ key: string; info: KeyInfo }> = [];
    const entries = this.kv.list<KeyInfo>({ prefix: [KV_KEY_PREFIX] });
    
    for await (const entry of entries) {
      const key = entry.key[1] as string;
      keys.push({ key, info: entry.value });
    }
    
    return keys;
  }

  getSystemKey(): string {
    return this.systemKey;
  }
}
