import { KeyManager, KeySource } from "./key_manager.ts";
import { SystemKeyManager } from "./system_key_manager.ts";
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
const systemKeyManager = new SystemKeyManager();
await Promise.all([
  keyManager.init(),
  systemKeyManager.init()
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
  const systemKey = await systemKeyManager.getNextKey();
  targetUrl.searchParams.set("key", systemKey);
  console.log('WebSocket connecting to Gemini with system key:', 
    `${systemKey.slice(0, 4)}...${systemKey.slice(-4)}`);
  
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
    const systemKey = await systemKeyManager.getNextKey();
  
    // 创建新的请求头
    const newHeaders = new Headers(req.headers);
    newHeaders.set("Authorization", `Bearer ${systemKey}`);
  
    try {
      const response = await fetch(targetUrl.toString(), {
        method: req.method,
        headers: newHeaders,
        body: req.body
      });

      if (!response.ok) {
        await systemKeyManager.recordError(systemKey);
      }

      return addCorsHeaders(new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }));
    } catch (error) {
      await systemKeyManager.recordError(systemKey);
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

  return addCorsHeaders(new Response(JSON.stringify({ 
    error: "Not Found" 
  }), { 
    status: 404,
    headers: { "content-type": "application/json" }
  }));
}

// System Key 管理相关的路由
async function handleSystemKeyManagement(req: Request): Promise<Response> {
  // 验证管理员token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return addCorsHeaders(new Response('Unauthorized', { status: 401 }));
  }

  const token = authHeader.split(' ')[1];
  if (!validateAdminToken(token)) {
    return addCorsHeaders(new Response('Invalid admin token', { status: 401 }));
  }

  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === 'GET' && url.pathname === '/admin/system-keys') {
      const keys = await systemKeyManager.getAllKeys();
      return addCorsHeaders(new Response(JSON.stringify(keys), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    if (method === 'POST' && url.pathname === '/admin/system-keys') {
      const data = await req.json();
      const { key, account, note } = data;

      if (!key || !account) {
        return addCorsHeaders(new Response('Missing required fields', { status: 400 }));
      }

      await systemKeyManager.addKey(key, account, note);
      return addCorsHeaders(new Response('Key added successfully', { status: 200 }));
    }

    return addCorsHeaders(new Response('Not Found', { status: 404 }));
  } catch (error) {
    console.error('Error in system key management:', error);
    return addCorsHeaders(new Response('Internal Server Error', { status: 500 }));
  }
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

  // System Key 管理相关的路由
  if (url.pathname.startsWith("/api/admin/system-keys")) {
    return handleSystemKeyManagement(req);
  }

  // Key 管理相关的路由
  if (url.pathname.startsWith("/api/admin/keys")) {
    return handleKeyManagement(req);
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