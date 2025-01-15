import { KeyManager } from "./key_manager.ts";
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

async function handleWebSocket(req: Request): Promise<Response> {
  const { socket: clientWs, response } = Deno.upgradeWebSocket(req);
  
  const url = new URL(req.url);
  const targetUrl = `wss://generativelanguage.googleapis.com${url.pathname}${url.search}`;
  
  console.log('Target URL:', targetUrl);
  
  const pendingMessages: string[] = [];
  const targetWs = new WebSocket(targetUrl);
  
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
  try {
    // 验证 API Key
    const authHeader = req.headers.get("Authorization");
    const apiKey = authHeader?.replace("Bearer ", "");

    if (!apiKey) {
      return new Response("Missing API Key", { status: 401 });
    }

    const isValidKey = await keyManager.validateKey(apiKey);
    if (!isValidKey) {
      return new Response("Invalid or expired API Key", { status: 401 });
    }

    // 替换请求头中的 API Key 为系统 Key
    const newHeaders = new Headers(req.headers);
    newHeaders.set("Authorization", `Bearer ${SYSTEM_KEY}`);
    
    const modifiedReq = new Request(req.url, {
      method: req.method,
      headers: newHeaders,
      body: req.body,
    });

    const worker = await import('./api_proxy/worker.mjs');
    return await worker.default.fetch(modifiedReq);
  } catch (error) {
    console.error('API request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStatus = (error as { status?: number }).status || 500;
    return new Response(errorMessage, {
      status: errorStatus,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    });
  }
}

// 添加 key 管理相关的路由
async function handleKeyManagement(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // 验证管理接口的 token
  if (!validateAdminToken(req.headers.get("Authorization"))) {
    return new Response("Unauthorized", { 
      status: 401,
      headers: {
        "content-type": "application/json"
      }
    });
  }

  if (req.method === "POST" && url.pathname === "/admin/keys") {
    try {
      const { validityDays } = await req.json();
      if (!validityDays || typeof validityDays !== 'number' || validityDays <= 0) {
        return new Response(JSON.stringify({ 
          error: "Invalid validityDays parameter" 
        }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      const newKey = await keyManager.createKey(validityDays);
      return new Response(JSON.stringify({ 
        key: newKey,
        expiresIn: `${validityDays} days`
      }), {
        headers: { "content-type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: "Invalid request body" 
      }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/admin/keys") {
    const keys = await keyManager.listKeys();
    return new Response(JSON.stringify({
      total: keys.length,
      keys: keys
    }), {
      headers: { "content-type": "application/json" }
    });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/admin/keys/")) {
    const keyToDelete = url.pathname.split("/").pop();
    if (keyToDelete) {
      const success = await keyManager.deactivateKey(keyToDelete);
      return new Response(JSON.stringify({ 
        success,
        message: success ? "Key deactivated successfully" : "Key not found"
      }), {
        status: success ? 200 : 404,
        headers: { "content-type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ 
    error: "Not Found" 
  }), { 
    status: 404,
    headers: { "content-type": "application/json" }
  });
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

  if (url.pathname.endsWith("/chat/completions") ||
      url.pathname.endsWith("/embeddings") ||
      url.pathname.endsWith("/models")) {
    return handleAPIRequest(req);
  }

  // 静态文件处理
  try {
    let filePath = url.pathname;
    if (filePath === '/' || filePath === '/index.html') {
      filePath = '/index.html';
    }

    const fullPath = `${Deno.cwd()}/src/static${filePath}`;

    const file = await Deno.readFile(fullPath);
    const contentType = getContentType(filePath);

    return new Response(file, {
      headers: {
        'content-type': `${contentType};charset=UTF-8`,
      },
    });
  } catch (e) {
    console.error('Error details:', e);
    return new Response('Not Found', { 
      status: 404,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      }
    });
  }
}

Deno.serve(handleRequest); 