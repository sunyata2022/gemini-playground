// 清空 KV 存储的脚本
async function clearKV() {
    try {
        const kv = await Deno.openKv();
        const prefix = "api_key:";
        const entries = kv.list({ prefix: [prefix] });
        let count = 0;

        for await (const entry of entries) {
            await kv.delete(entry.key);
            count++;
        }

        console.log(`成功清除 ${count} 个密钥`);
        kv.close();
    } catch (error) {
        console.error('清除 KV 时出错:', error);
    }
}

await clearKV();
