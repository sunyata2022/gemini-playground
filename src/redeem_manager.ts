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
const BATCH_PREFIX = "redeem:batch";
const CODE_PREFIX = "redeem:code";

// 使用URL安全的字符集
const generateRedeemCode = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-', REDEEM_CODE_LENGTH);

export class RedeemManager {
    private kv: Deno.Kv;

    async init() {
        this.kv = await Deno.openKv();
    }

    // 获取新的批次ID
    private async getNextBatchId(): Promise<string> {
        const counter = await this.kv.get<number>(BATCH_COUNTER_KEY);
        const nextId = (counter.value || 0) + 1;
        
        const result = await this.kv.atomic()
            .check(counter)
            .set(BATCH_COUNTER_KEY, nextId)
            .commit();
        
        if (!result.ok) {
            console.error("[RedeemManager] Failed to get next batch ID");
            throw new Error("获取批次ID失败");
        }

        return `B${nextId.toString(16).toUpperCase()}`;
    }

    // 获取批次信息
    async getBatchInfo(batchId: string): Promise<RedeemBatchInfo | null> {
        console.log("[RedeemManager] Getting batch info:", batchId);
        const result = await this.kv.get<RedeemBatchInfo>([BATCH_PREFIX, batchId]);
        return result.value;
    }

    // 获取兑换码信息
    async getRedeemCodeInfo(batchId: string, code: string): Promise<RedeemCodeInfo | null> {
        const result = await this.kv.get<RedeemCodeInfo>([CODE_PREFIX, batchId, code]);
        return result.value;
    }

    // 获取批次下的所有兑换码
    async getCodesInBatch(batchId: string): Promise<RedeemCodeInfo[]> {
        console.log("[RedeemManager] Getting all codes in batch:", batchId);
        const codes: RedeemCodeInfo[] = [];
        const iter = this.kv.list<RedeemCodeInfo>({ prefix: [CODE_PREFIX, batchId] });
        for await (const entry of iter) {
            codes.push(entry.value);
        }
        return codes;
    }

    // 获取所有批次
    async getAllBatches(): Promise<RedeemBatchInfo[]> {
        console.log("[RedeemManager] Getting all batches");
        const batches: RedeemBatchInfo[] = [];
        const iter = this.kv.list<RedeemBatchInfo>({ prefix: [BATCH_PREFIX] });
        for await (const entry of iter) {
            batches.push(entry.value);
        }
        return batches;
    }

    // 创建新的兑换码批次
    async createBatch(validityDays: number, count: number, note?: string): Promise<RedeemBatchInfo> {
        console.log("[RedeemManager] Creating new batch:", { validityDays, count, note });
        const batchId = await this.getNextBatchId();
        const now = Date.now();
        
        const batchInfo: RedeemBatchInfo = {
            batchId,
            note,
            createdAt: now,
            validityDays,
            totalCodes: count,
            usedCodes: 0
        };

        // 生成所有兑换码并存储
        const atomic = this.kv.atomic();
        atomic.set([BATCH_PREFIX, batchId], batchInfo);

        const generatedCodes = new Set<string>();
        let retries = 0;
        const MAX_RETRIES = count * 3; // 最多尝试次数为请求数量的3倍

        while (generatedCodes.size < count && retries < MAX_RETRIES) {
            const code = generateRedeemCode();
            if (!generatedCodes.has(code)) {
                generatedCodes.add(code);
                const codeInfo: RedeemCodeInfo = {
                    code,
                    batchId,
                    isUsed: false
                };
                // 使用 check 确保 key 不存在
                atomic.check({ key: [CODE_PREFIX, batchId, code], versionstamp: null })
                      .set([CODE_PREFIX, batchId, code], codeInfo);
            }
            retries++;
        }

        if (generatedCodes.size < count) {
            console.error("[RedeemManager] Failed to generate unique codes for batch:", batchId);
            throw new Error(`无法生成足够的唯一兑换码，当前只生成了 ${generatedCodes.size} 个`);
        }

        const result = await atomic.commit();
        if (!result.ok) {
            console.error("[RedeemManager] Failed to create batch:", batchId);
            throw new Error("创建兑换码批次失败");
        }

        console.log("[RedeemManager] Successfully created batch:", batchId, "with", generatedCodes.size, "codes");
        return batchInfo;
    }

    // 使用兑换码
    async useCode(batchId: string, code: string, usedBy: string): Promise<{ success: boolean; message: string; validityDays?: number }> {
        console.log("[RedeemManager] Using code:", { batchId, code, usedBy });

        // 获取兑换码信息
        const codeInfo = await this.getRedeemCodeInfo(batchId, code);
        if (!codeInfo) {
            console.warn("[RedeemManager] Code not found:", { batchId, code });
            return { success: false, message: "兑换码不存在" };
        }

        if (codeInfo.isUsed) {
            console.warn("[RedeemManager] Code already used:", { batchId, code });
            return { success: false, message: "兑换码已被使用" };
        }

        // 获取批次信息
        const batchInfo = await this.getBatchInfo(batchId);
        if (!batchInfo) {
            console.warn("[RedeemManager] Batch not found:", batchId);
            return { success: false, message: "兑换码批次不存在" };
        }

        // 原子更新
        const atomic = this.kv.atomic();
        atomic
            .set([CODE_PREFIX, batchId, code], {
                ...codeInfo,
                isUsed: true,
                usedAt: Date.now(),
                usedBy
            })
            .set([BATCH_PREFIX, batchId], {
                ...batchInfo,
                usedCodes: batchInfo.usedCodes + 1
            });

        const result = await atomic.commit();
        if (!result.ok) {
            console.error("[RedeemManager] Failed to update code status:", { batchId, code });
            return { success: false, message: "更新兑换码状态失败" };
        }

        console.log("[RedeemManager] Successfully used code:", { batchId, code });
        return { 
            success: true, 
            message: "兑换成功",
            validityDays: batchInfo.validityDays
        };
    }

    // 删除批次
    async deleteBatch(batchId: string): Promise<{ success: boolean; message: string }> {
        console.log("[RedeemManager] Deleting batch:", batchId);
        
        const batchInfo = await this.getBatchInfo(batchId);
        if (!batchInfo) {
            console.warn("[RedeemManager] Batch not found:", batchId);
            return { success: false, message: "批次不存在" };
        }

        if (batchInfo.usedCodes > 0) {
            console.warn("[RedeemManager] Cannot delete batch with used codes:", batchId);
            return { success: false, message: "批次中存在已使用的兑换码，无法删除" };
        }

        const atomic = this.kv.atomic();
        
        // 删除所有兑换码
        const iter = this.kv.list({ prefix: [CODE_PREFIX, batchId] });
        for await (const entry of iter) {
            atomic.delete(entry.key);
        }

        // 删除批次信息
        atomic.delete([BATCH_PREFIX, batchId]);

        const result = await atomic.commit();
        if (!result.ok) {
            console.error("[RedeemManager] Failed to delete batch:", batchId);
            return { success: false, message: "删除失败" };
        }

        console.log("[RedeemManager] Successfully deleted batch:", batchId);
        return { success: true, message: "批次删除成功" };
    }
}
