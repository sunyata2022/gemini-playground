import { KeyManager, KeySource } from "./key_manager.ts";
import { SYSTEM_KEY, ADMIN_TOKEN, validateAdminToken } from "./config.ts";

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

// 初始化 KeyManager
const keyManager = new KeyManager(SYSTEM_KEY);
await keyManager.init();

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
  targetUrl.searchParams.set("key", SYSTEM_KEY);
  console.log('WebSocket connecting to Gemini with system key:', 
    `${SYSTEM_KEY.slice(0, 4)}...${SYSTEM_KEY.slice(-4)}`);
  
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

    // 替换请求头中的 API Key 为系统 Key
    const newHeaders = new Headers(req.headers);
    newHeaders.set("Authorization", `Bearer ${SYSTEM_KEY}`);
    console.log('Request headers updated with system key');
    
    const modifiedReq = new Request(req.url, {
      method: req.method,
      headers: newHeaders,
      body: req.body,
    });
    console.log('Modified request created, forwarding to worker');

    const worker = await import('./api_proxy/worker.mjs');
    const response = await worker.default.fetch(modifiedReq);
    return addCorsHeaders(response);
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

  if (req.method === "POST" && url.pathname === "/admin/keys") {
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

  if (req.method === "PUT" && url.pathname.match(/^\/admin\/keys\/[^/]+$/)) {
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

  if (req.method === "GET" && url.pathname === "/admin/keys") {
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

  // Key 管理相关的路由
  if (url.pathname.startsWith("/admin/keys")) {
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