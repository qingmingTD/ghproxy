export default {
  async fetch(request, env, ctx) {
    // 定义默认目标（GitHub）
    const defaultTargetHost = "github.com";
    const defaultTargetProtocol = "https";
    
    // 解析请求URL
    const url = new URL(request.url);
    
    // 处理CORS预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    
    // 变量初始化
    let targetHost, targetProtocol, targetUrl;
    let isDynamicProxy = false;
    
    // 检查是否是动态代理模式（路径中包含http://或https://）
    const pathParts = url.pathname.split('/').filter(part => part);
    if (pathParts.length > 0 && ['http:', 'https:'].includes(pathParts[0])) {
      // 动态代理模式
      isDynamicProxy = true;
      targetProtocol = pathParts[0].replace(':', ''); // 'http' 或 'https'
      targetHost = pathParts[1];
      
      // 构建新的路径（去掉协议和域名部分）
      const newPath = pathParts.slice(2).length > 0 ? `/${pathParts.slice(2).join('/')}` : '/';
      
      // 构建目标URL
      targetUrl = new URL(`${targetProtocol}://${targetHost}${newPath}${url.search}${url.hash}`);
    } else {
      // 默认代理GitHub模式
      targetHost = defaultTargetHost;
      targetProtocol = defaultTargetProtocol;
      
      // 构建目标URL（使用原始路径）
      targetUrl = new URL(`${targetProtocol}://${targetHost}${url.pathname}${url.search}${url.hash}`);
    }
    
    // 复制并修改请求头
    const headers = new Headers(request.headers);
    headers.set("Host", targetHost);
    headers.set("Origin", `${targetProtocol}://${targetHost}`);
    
    // 添加X-Forwarded-For头以保留客户端IP
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "";
    if (clientIP) {
      headers.set("X-Forwarded-For", clientIP);
    }
    
    // 移除可能引起问题的Cloudflare特定头
    headers.delete("CF-IPCountry");
    headers.delete("CF-RAY");
    
    // 创建新请求
    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      duplex: request.duplex,
      redirect: "manual", // 手动处理重定向
    });
    
    try {
      // 尝试从缓存获取响应
      const cache = caches.default;
      const cachedResponse = await cache.match(request);
      
      // 如果缓存存在且不是POST请求，直接返回缓存
      if (cachedResponse && request.method !== "POST") {
        const responseWithCORS = new Response(cachedResponse.body, cachedResponse);
        responseWithCORS.headers.set("Access-Control-Allow-Origin", "*");
        return responseWithCORS;
      }
      
      // 发送请求到目标服务器
      const response = await fetch(newRequest);
      
      // 处理重定向
      if (response.redirected) {
        const redirectedUrl = new URL(response.url);
        
        if (isDynamicProxy) {
          // 动态代理模式：将重定向URL转换为代理URL格式
          const proxyRedirectUrl = new URL(request.url);
          proxyRedirectUrl.pathname = `/${redirectedUrl.protocol}/${redirectedUrl.hostname}${redirectedUrl.pathname}`;
          proxyRedirectUrl.search = redirectedUrl.search;
          proxyRedirectUrl.hash = redirectedUrl.hash;
          
          return Response.redirect(proxyRedirectUrl.toString(), response.status);
        } else {
          // 默认GitHub代理模式：保持在GitHub域名下重定向
          if (redirectedUrl.hostname === defaultTargetHost) {
            redirectedUrl.hostname = url.hostname;
            redirectedUrl.protocol = url.protocol;
            return Response.redirect(redirectedUrl.toString(), response.status);
          }
        }
      }
      
      // 准备响应并添加CORS头
      const responseWithCORS = new Response(response.body, response);
      responseWithCORS.headers.set("Access-Control-Allow-Origin", "*");
      
      // 缓存成功的GET请求（5分钟）
      if (request.method === "GET" && response.ok) {
        ctx.waitUntil(cache.put(request, responseWithCORS.clone()));
      }
      
      return responseWithCORS;
    } catch (e) {
      // 处理错误
      return new Response(`代理请求失败: ${e.message}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
