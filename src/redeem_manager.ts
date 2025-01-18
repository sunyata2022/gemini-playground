import { customAlphabet } from "https://deno.land/x/nanoid/mod.ts";

interface RedeemBatchInfo {
    batchId: string;        // 批次ID
    note?: string;          // 批次备注
    createdAt: number;      // 创建时间
    validityDays: number;   // 该批次兑换码对应的key有效期
    totalCodes: number;     // 总共生成的兑换码数量
    usedCodes: number;      // 已使用的兑换码数量
}

interface RedeemCodeInfo {
    code: string;           // 兑换码
    batchId: string;        // 所属批次ID
    isUsed: boolean;        // 是否已使用
    usedAt?: number;        // 使用时间
    usedBy?: string;        // 兑换获得的key
}

const REDEEM_CODE_LENGTH = 12;
const BATCH_COUNTER_KEY = ["redeem_batch_counter"];

// 使用URL安全的字符集
const generateRedeemCode = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-', REDEEM_CODE_LENGTH);

export class RedeemManager {
    private kv: Deno.Kv;

    async init() {
        this.kv = await Deno.openKv();
    }

    // 获取新的批次ID
    private async getNextBatchId(): Promise<string> {
        const atomic = this.kv.atomic();
        const counter = await this.kv.get<number>(BATCH_COUNTER_KEY);
        const nextId = (counter.value || 0) + 1;
        
        // 更新计数器
        atomic.set(BATCH_COUNTER_KEY, nextId);
        const result = await atomic.commit();
        
        if (!result.ok) {
            throw new Error("获取批次ID失败");
        }

        // 转换为16进制，自动增长位数
        return `B${nextId.toString(16).toUpperCase()}`;
    }

    // 尝试生成并存储兑换码
    private async tryStoreCode(batchId: string): Promise<string> {
        const MAX_RETRIES = 3;
        let retries = 0;
        
        while (retries < MAX_RETRIES) {
            try {
                const code = generateRedeemCode();
                // 尝试存储，如果code已存在会失败
                const result = await this.kv.atomic()
                    .check({ key: ["redeem_code:", batchId, code], versionstamp: null }) // 确保key不存在
                    .commit();
                
                if (result.ok) {
                    return code;
                }
            } catch {
                // 忽略错误，继续重试
            }
            retries++;
        }
        throw new Error("无法生成唯一的兑换码");
    }

    // 创建新的兑换码批次
    async createBatch(validityDays: number, count: number, note?: string): Promise<RedeemBatchInfo> {
        // 获取新的批次ID
        const batchId = await this.getNextBatchId();
        const now = Date.now();
        
        // 先生成所有兑换码
        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            try {
                const code = await this.tryStoreCode(batchId);
                codes.push(code);
            } catch (error) {
                console.error("生成兑换码失败:", error);
                throw new Error("生成兑换码失败");
            }
        }

        const batchInfo: RedeemBatchInfo = {
            batchId,
            note,
            createdAt: now,
            validityDays,
            totalCodes: count,
            usedCodes: 0
        };

        // 存储批次信息
        const atomic = this.kv.atomic();
        atomic.set(["redeem_batch:", batchId], batchInfo);

        // 存储所有兑换码
        for (const code of codes) {
            const codeInfo: RedeemCodeInfo = {
                code,
                batchId,
                isUsed: false
            };
            atomic.set(["redeem_code:", batchId, code], codeInfo);
        }

        const result = await atomic.commit();
        if (!result.ok) {
            throw new Error("存储兑换码批次失败");
        }

        return batchInfo;
    }

    // 获取批次信息
    async getBatchInfo(batchId: string): Promise<RedeemBatchInfo | null> {
        const result = await this.kv.get<RedeemBatchInfo>(["redeem_batch:", batchId]);
        return result.value;
    }

    // 获取批次下的所有兑换码
    async getCodesInBatch(batchId: string): Promise<RedeemCodeInfo[]> {
        const codes: RedeemCodeInfo[] = [];
        const iter = this.kv.list<RedeemCodeInfo>({ prefix: ["redeem_code:", batchId] });
        for await (const entry of iter) {
            codes.push(entry.value);
        }
        return codes;
    }

    // 获取所有批次
    async getAllBatches(): Promise<RedeemBatchInfo[]> {
        const batches: RedeemBatchInfo[] = [];
        const iter = this.kv.list<RedeemBatchInfo>({ prefix: ["redeem_batch:"] });
        for await (const entry of iter) {
            batches.push(entry.value);
        }
        return batches;
    }

    // 使用兑换码
    async useCode(code: string, usedBy: string): Promise<{ success: boolean; message: string; validityDays?: number }> {
        // 查找兑换码
        const codeInfo = await this.findCode(code);
        if (!codeInfo) {
            return { success: false, message: "兑换码不存在" };
        }

        if (codeInfo.isUsed) {
            return { success: false, message: "兑换码已被使用" };
        }

        // 获取批次信息
        const batchInfo = await this.kv.get<RedeemBatchInfo>(["redeem_batch:", codeInfo.batchId]);
        if (!batchInfo.value) {
            return { success: false, message: "兑换码批次不存在" };
        }

        // 更新兑换码状态
        const now = Date.now();
        const updatedCodeInfo: RedeemCodeInfo = {
            ...codeInfo,
            isUsed: true,
            usedAt: now,
            usedBy
        };

        // 更新批次使用数量
        const updatedBatchInfo: RedeemBatchInfo = {
            ...batchInfo.value,
            usedCodes: batchInfo.value.usedCodes + 1
        };

        // 原子更新
        const result = await this.kv.atomic()
            .set(["redeem_code:", codeInfo.batchId, code], updatedCodeInfo)
            .set(["redeem_batch:", codeInfo.batchId], updatedBatchInfo)
            .commit();

        if (!result.ok) {
            return { success: false, message: "更新兑换码状态失败" };
        }

        return { 
            success: true, 
            message: "兑换成功",
            validityDays: batchInfo.value.validityDays
        };
    }

    // 标记兑换码已使用
    async markCodeAsUsed(batchId: string, code: string, apiKey: string): Promise<boolean> {
        const codeInfo = await this.kv.get<RedeemCodeInfo>(["redeem_code:", batchId, code]);
        if (!codeInfo.value || codeInfo.value.isUsed) {
            return false;
        }

        // 更新兑换码信息
        const updatedCodeInfo: RedeemCodeInfo = {
            ...codeInfo.value,
            isUsed: true,
            usedAt: Date.now(),
            usedBy: apiKey
        };
        await this.kv.set(["redeem_code:", batchId, code], updatedCodeInfo);

        // 更新批次的已使用数量
        const batchInfo = await this.getBatchInfo(batchId);
        if (batchInfo) {
            const updatedBatchInfo: RedeemBatchInfo = {
                ...batchInfo,
                usedCodes: batchInfo.usedCodes + 1
            };
            await this.kv.set(["redeem_batch:", batchId], updatedBatchInfo);
        }

        return true;
    }

    // 删除批次
    async deleteBatch(batchId: string): Promise<{ success: boolean; message: string }> {
        // 先检查批次是否存在
        const batchInfo = await this.getBatchInfo(batchId);
        if (!batchInfo) {
            return { success: false, message: "批次不存在" };
        }

        // 检查是否有已使用的兑换码
        if (batchInfo.usedCodes > 0) {
            return { success: false, message: "批次中存在已使用的兑换码，无法删除" };
        }

        // 删除所有兑换码
        const iter = this.kv.list({ prefix: ["redeem_code:", batchId] });
        const deletePromises: Promise<void>[] = [];
        for await (const entry of iter) {
            deletePromises.push(this.kv.delete(entry.key));
        }

        // 删除批次信息
        deletePromises.push(this.kv.delete(["redeem_batch:", batchId]));

        // 执行所有删除操作
        await Promise.all(deletePromises);

        return { success: true, message: "批次删除成功" };
    }

    private async findCode(code: string): Promise<RedeemCodeInfo | null> {
        // 遍历所有批次查找兑换码
        const iter = this.kv.list<RedeemCodeInfo>({ prefix: ["redeem_code:"] });
        for await (const entry of iter) {
            if (entry.value.code === code) {
                return entry.value;
            }
        }
        return null;
    }
}
