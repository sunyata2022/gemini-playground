import { KeyManager, KeySource } from "./key_manager.ts";
import { GeminiKeyManager } from "./gemini_key_manager.ts";
import { RedeemManager } from "./redeem_manager.ts";
import { ADMIN_TOKEN, validateAdminToken } from "./config.ts";

const getContentType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const types: Record<string, string> = {
    'js': 'application/javascript',
    'css': 'text/css',
    'html': 'text/html',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif'
  };
  return types[ext] || 'text/plain';
};

// 初始化 managers
const keyManager = new KeyManager();
const geminiKeyManager = new GeminiKeyManager();
const redeemManager = new RedeemManager();
await Promise.all([
  keyManager.init(),
  geminiKeyManager.init(),
  redeemManager.init()
]);

// 提取共同的 API Key 验证逻辑
async function validateAndGetSystemKey(apiKey: string | null): Promise<{ isValid: boolean; error?: string }> {
  console.log('Validating API Key:', apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'null');
  
  if (!apiKey) {
    console.log('API Key validation failed: Missing API Key');
    return { isValid: false, error: "Missing API Key" };
  }

  const isValidKey = await keyManager.validateKey(apiKey);
  console.log('API Key validation result:', isValidKey);
  
  if (!isValidKey) {
    console.log('API Key validation failed: Invalid or expired');
    return { isValid: false, error: "Invalid or expired API Key" };
  }

  console.log('API Key validation successful');
  return { isValid: true };
}

function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "*");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Access-Control-Allow-Credentials", "true");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleWebSocket(req: Request): Promise<Response> {
  // 从 URL 参数中获取 API Key
  const url = new URL(req.url);
  const apiKey = url.searchParams.get("key");
  console.log('WebSocket request received, URL:', url.toString());
  
  // 验证 API Key
  const validation = await validateAndGetSystemKey(apiKey);
  if (!validation.isValid) {
    console.log('WebSocket connection rejected:', validation.error);
    return addCorsHeaders(new Response(validation.error, { status: 401 }));
  }
  
  // 使用系统 Key 创建新的目标 URL
  const targetUrl = new URL(`wss://generativelanguage.googleapis.com${url.pathname}`);
  const geminiKey = await geminiKeyManager.getNextKey();
  targetUrl.searchParams.set("key", geminiKey);
  console.log('WebSocket connecting to Gemini with Gemini key:', 
    `${geminiKey.slice(0, 4)}...${geminiKey.slice(-4)}`);
  
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);
  const targetWs = new WebSocket(targetUrl.toString());
  
  const pendingMessages: string[] = [];
  targetWs.onopen = () => {
    console.log('Connected to Gemini');
    pendingMessages.forEach(msg => targetWs.send(msg));
    pendingMessages.length = 0;
  };

  clientWs.onmessage = (event) => {
    console.log('Client message received');
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(event.data);
    } else {
      pendingMessages.push(event.data);
    }
  };

  targetWs.onmessage = (event) => {
    console.log('Gemini message received');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(event.data);
    }
  };

  clientWs.onclose = (event) => {
    console.log('Client connection closed');
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.close(1000, event.reason);
    }
  };

  targetWs.onclose = (event) => {
    console.log('Gemini connection closed');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(event.code, event.reason);
    }
  };

  targetWs.onerror = (error) => {
    console.error('Gemini WebSocket error:', error);
  };

  return response;
}

async function handleAPIRequest(req: Request): Promise<Response> {
  // 处理 OPTIONS 请求
  if (req.method === "OPTIONS") {
    return addCorsHeaders(new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true",
      }
    }));
  }

  try {
    console.log('API request received:', req.url);
    
    // 从请求头或 query string 中获取 API Key
    const url = new URL(req.url);
    const queryKey = url.searchParams.get("key");
    const authHeader = req.headers.get("Authorization");
    const headerKey = authHeader?.replace("Bearer ", "");
    const apiKey = queryKey || headerKey;
    console.log('API Key present:', !!apiKey);

    // 验证 API Key
    const validation = await validateAndGetSystemKey(apiKey);
    if (!validation.isValid) {
      console.log('API request rejected:', validation.error);
      return addCorsHeaders(new Response(validation.error, { status: 401 }));
    }

    // 转发到 Gemini API
    const targetUrl = new URL(`https://generativelanguage.googleapis.com${url.pathname}${url.search}`);
    const geminiKey = await geminiKeyManager.getNextKey();
  
    // 创建新的请求头
    const newHeaders = new Headers(req.headers);
    newHeaders.set("Authorization", `Bearer ${geminiKey}`);
  
    try {
      const response = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: newHeaders,
        body: req.body
      });

      if (!response.ok) {
        await geminiKeyManager.recordError(geminiKey);
      }

      return addCorsHeaders(new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }));
    } catch (error) {
      await geminiKeyManager.recordError(geminiKey);
      throw error;
    }
  } catch (error) {
    console.error('API request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStatus = (error as { status?: number }).status || 500;
    return addCorsHeaders(new Response(errorMessage, {
      status: errorStatus,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    }));
  }
}

// 添加 key 管理相关的路由
async function handleKeyManagement(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // 验证管理接口的 token
  if (!validateAdminToken(req.headers.get("Authorization"))) {
    return addCorsHeaders(new Response("Unauthorized", { 
      status: 401,
      headers: {
        "content-type": "application/json"
      }
    }));
  }

  if (req.method === "POST" && url.pathname === "/api/admin/keys") {
    try {
      const { validityDays, note } = await req.json();
      if (!validityDays || typeof validityDays !== 'number' || validityDays <= 0) {
        return addCorsHeaders(new Response(JSON.stringify({ 
          error: "Invalid validityDays parameter" 
        }), {
          status: 400,
          headers: { "content-type": "application/json" }
        }));
      }

      const newKey = await keyManager.createKey(validityDays, KeySource.ADMIN_MANUAL, note);
      return addCorsHeaders(new Response(JSON.stringify({ 
        key: newKey,
        expiresIn: `${validityDays} days`
      }), {
        headers: { "content-type": "application/json" }
      }));
    } catch (error) {
      return addCorsHeaders(new Response(JSON.stringify({ 
        error: "Invalid request body" 
      }), {
        status: 400,
        headers: { "content-type": "application/json" }
      }));
    }
  }

  if (req.method === "PUT" && url.pathname.match(/^\/api\/admin\/keys\/[^/]+$/)) {
    try {
      const key = url.pathname.split("/").pop()!;
      const { note, expiryDays, active } = await req.json();
      
      const success = await keyManager.updateKey(key, { note, expiryDays, active });
      return addCorsHeaders(new Response(JSON.stringify({ 
        success,
        message: success ? "Key updated successfully" : "Key not found"
      }), {
        status: success ? 200 : 404,
        headers: { "content-type": "application/json" }
      }));
    } catch (error) {
      return addCorsHeaders(new Response(JSON.stringify({ 
        error: "Invalid request body" 
      }), {
        status: 400,
        headers: { "content-type": "application/json" }
      }));
    }
  }

  if (req.method === "GET" && url.pathname === "/api/admin/keys") {
    const keys = await keyManager.listKeys();
    return addCorsHeaders(new Response(JSON.stringify({
      total: keys.length,
      keys: keys
    }), {
      headers: { "content-type": "application/json" }
    }));
  }

  if (req.method === "DELETE" && url.pathname.match(/^\/api\/admin\/keys\/[^/]+$/)) {
    try {
      const key = url.pathname.split("/").pop()!;
      const success = await keyManager.deleteKey(key);
      return addCorsHeaders(new Response(JSON.stringify({ 
        success,
        message: success ? "Key deleted successfully" : "Key not found"
      }), {
        status: success ? 200 : 404,
        headers: { "content-type": "application/json" }
      }));
    } catch (error) {
      return addCorsHeaders(new Response(JSON.stringify({ 
        error: "Failed to delete key" 
      }), {
        status: 500,
        headers: { "content-type": "application/json" }
      }));
    }
  }

  return addCorsHeaders(new Response(JSON.stringify({ 
    error: "Not Found" 
  }), { 
    status: 404,
    headers: { "content-type": "application/json" }
  }));
}

// Gemini Key 管理相关的路由
async function handleGeminiKeyManagement(req: Request): Promise<Response> {
  // 验证管理员token，保持和 handleKeyManagement 一致的处理方式
  if (!validateAdminToken(req.headers.get("Authorization"))) {
    return addCorsHeaders(new Response("Unauthorized", { 
      status: 401,
      headers: { "content-type": "application/json" }
    }));
  }

  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === 'GET' && url.pathname === '/api/admin/gemini-keys') {
      const keys = await geminiKeyManager.listKeys();
      return addCorsHeaders(new Response(JSON.stringify(keys), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    if (method === 'POST' && url.pathname === '/api/admin/gemini-keys') {
      const data = await req.json();
      const { key, account, note } = data;

      if (!key || !account) {
        return addCorsHeaders(new Response('Missing required fields', { status: 400 }));
      }

      await geminiKeyManager.addKey(key, account, note);
      return addCorsHeaders(new Response(JSON.stringify({ message: 'Key added successfully' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    if (method === 'PUT' && url.pathname.startsWith('/api/admin/gemini-keys/')) {
      const key = url.pathname.split('/').pop();
      const { account, note, status } = await req.json();
      
      console.log('Updating key:', key, { account, note, status });
      
      if (!key) {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing key' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      // 检查key是否存在
      const keyInfo = await geminiKeyManager.getKeyInfo(key);
      if (!keyInfo) {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Key not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      // 更新状态
      if (status) {
        console.log('Updating status to:', status);
        if (!['active', 'inactive'].includes(status)) {
          return addCorsHeaders(new Response(JSON.stringify({ error: 'Invalid status' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        // 尝试更新状态，如果返回false说明key已经在目标状态了
        if (status === 'active') {
          await geminiKeyManager.activateKey(key);
        } else {
          await geminiKeyManager.deactivateKey(key);
        }
      }

      // 更新信息
      if (account !== undefined || note !== undefined) {
        console.log('Updating account/note');
        if (!await geminiKeyManager.updateKeyInfo(key, { account, note })) {
          console.log('Failed to update key info');
          return addCorsHeaders(new Response(JSON.stringify({ error: 'Failed to update key info' }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      }

      return addCorsHeaders(new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/admin/gemini-keys/')) {
      const key = url.pathname.split('/').pop();
      
      if (!key) {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing key' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      const success = await geminiKeyManager.removeKey(key);
      if (!success) {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Key not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      return addCorsHeaders(new Response(JSON.stringify({ message: 'Key deleted successfully' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    return addCorsHeaders(new Response(JSON.stringify({ error: 'Not Found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (error) {
    console.error('Error in system key management:', error);
    return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

// 添加兑换码管理相关的路由
async function handleRedeemManagement(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const adminToken = req.headers.get("Authorization")?.split(" ")[1];

  // 管理员接口
  if (url.pathname.startsWith("/api/admin/redeem")) {
    if (!validateAdminToken(adminToken)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/redeem/batch") {
      const body = await req.json();
      const { validityDays, count, note } = body;
      
      if (!validityDays || !count || count <= 0) {
        return new Response("Invalid parameters", { status: 400 });
      }

      const batch = await redeemManager.createBatch(validityDays, count, note);
      return new Response(JSON.stringify(batch), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/redeem/batches") {
      const batches = await redeemManager.getAllBatches();
      return new Response(JSON.stringify(batches), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/admin/redeem/batch/")) {
      const batchId = url.pathname.split("/").pop();
      if (!batchId) {
        return new Response("Invalid batch ID", { status: 400 });
      }

      const codes = await redeemManager.getCodesInBatch(batchId);
      return new Response(JSON.stringify(codes), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/redeem/batch/")) {
      const batchId = url.pathname.split("/").pop();
      if (!batchId) {
        return new Response("Invalid batch ID", { status: 400 });
      }

      const result = await redeemManager.deleteBatch(batchId);
      if (!result.success) {
        return new Response(JSON.stringify({ error: result.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // 用户兑换接口
  if (req.method === "POST" && url.pathname === "/api/redeem") {
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return new Response("Missing redeem code", { status: 400 });
    }

    const result = await redeemManager.redeemCode(code);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 创建新的API Key
    const apiKey = await keyManager.createKey(
      result.batchInfo!.validityDays,
      KeySource.CODE_EXCHANGE,
      `Redeemed from code: ${code}`
    );

    // 标记兑换码已使用
    await redeemManager.markCodeAsUsed(result.batchInfo!.batchId, code, apiKey);

    return new Response(JSON.stringify({ apiKey }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
}

async function handleStaticFile(pathname: string): Promise<Response> {
  try {
    // 如果请求的是根路径，返回 index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // 如果请求的是 /admin，返回 admin.html
    if (pathname === '/admin') {
      pathname = '/admin.html';
    }

    const filePath = `./src/static${pathname}`;
    const fileContent = await Deno.readFile(filePath);
    return addCorsHeaders(new Response(fileContent, {
      headers: {
        'content-type': getContentType(pathname),
      },
    }));
  } catch (error) {
    console.error('Static file error:', error);
    return addCorsHeaders(new Response('Not Found', { status: 404 }));
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log('Request URL:', req.url);

  // 管理员验证路由
  if (url.pathname === "/api/admin/verify") {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }
    
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (validateAdminToken(authHeader)) {
        return addCorsHeaders(new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: "Invalid admin token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }));
    }
    
    return addCorsHeaders(new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    }));
  }

  // Gemini Key 管理相关的路由
  if (url.pathname.startsWith("/api/admin/gemini-keys")) {
    return handleGeminiKeyManagement(req);
  }

  // Key 管理相关的路由
  if (url.pathname.startsWith("/api/admin/keys")) {
    return handleKeyManagement(req);
  }

  // 兑换码管理相关的路由
  if (url.pathname.startsWith("/api/admin/redeem") || url.pathname === "/api/redeem") {
    return addCorsHeaders(await handleRedeemManagement(req));
  }

  // WebSocket 处理
  if (req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }

  // API 请求处理
  if (url.pathname.endsWith("/chat/completions") ||
      url.pathname.endsWith("/embeddings") ||
      url.pathname.endsWith("/models") ||
      url.pathname.endsWith(":generateContent")) {
    return handleAPIRequest(req);
  }

  // 静态文件处理
  return handleStaticFile(url.pathname);
}

Deno.serve(handleRequest); 