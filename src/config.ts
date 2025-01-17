import { load } from "https://deno.land/std/dotenv/mod.ts";

// 在本地开发环境中加载 .env 文件
if (Deno.env.get("DENO_ENV") !== "production") {
  try {
    const env = await load({
      envPath: ".env",
      examplePath: ".env.example",
      export: true,
    });
    console.log("Loaded environment variables from .env file");
  } catch (error) {
    console.warn("Failed to load .env file:", error.message);
    console.warn("Using default values for environment variables");
  }
}

// 用于验证管理接口的 token
export const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || "defaultAdminToken39CharactersLongForTesting";

export function validateAdminToken(authHeader: string | null): boolean {
  if (!authHeader) return false;
  
  const token = authHeader.replace("Bearer ", "");
  return token === ADMIN_TOKEN;
}
