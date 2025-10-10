# Cloudflare Worker 混合代理使用说明

## 一、核心功能
支持两种代理模式，兼顾默认 GitHub 访问与灵活自定义代理需求，内置 CORS 跨域支持及 GET 请求缓存（有效期 5 分钟）。


## 二、两种代理方式
### 1. 默认模式：代理 GitHub
直接通过自定义域名访问，自动映射至 GitHub 官网，路径与参数会完整透传。

| 自定义域名访问地址               | 实际代理地址                 |
|----------------------------------|------------------------------|
| `https://你的域名`               | `https://github.com`         |
| `https://你的域名/用户名/仓库`   | `https://github.com/用户名/仓库` |
| `https://你的域名/search?q=关键词` | `https://github.com/search?q=关键词` |


### 2. 动态模式：代理任意网站
通过「自定义域名 + `/https://目标域名`」格式访问，支持 HTTP/HTTPS 协议，路径、查询参数均会同步传递。

| 自定义域名访问地址                                   | 实际代理地址                     |
|------------------------------------------------------|----------------------------------|
| `https://你的域名/https://example.com`                | `https://example.com`            |
| `https://你的域名/https://example.com/article?id=123` | `https://example.com/article?id=123` |
| `https://你的域名/http://old-site.com`                | `http://old-site.com`            |


## 三、简易部署步骤
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入「Workers 和 Pages」→「创建 Worker」，输入名称后部署。
2. 进入 Worker 编辑页，删除默认代码，粘贴混合代理代码，点击「保存并部署」。
3. 在「触发器」页面点击「添加自定义域」，绑定已在 Cloudflare 托管的域名，等待 DNS 生效（1-5 分钟）。


## 四、注意事项
1. 需遵守目标网站《用户协议》及当地法律法规，禁止用于违规爬取、规避审核等行为。
2. 部分反爬严格的网站（如 Google、淘宝）可能拒绝代理请求，表现为 403/503 错误。
3. 若需修改默认代理目标（默认 GitHub），可调整代码中 `defaultTargetHost` 和 `defaultTargetProtocol` 字段。


## 五、常见问题（FAQ）
- **Q：访问时提示“代理请求失败”？**  
  A：先检查目标域名是否可直接访问，再通过 Cloudflare Worker「日志」查看具体错误（如 DNS 解析失败、目标网站拒绝连接）。
- **Q：重定向后地址跳转到目标域名而非自定义域名？**  
  A：部分网站会强制校验 `Host` 头，可尝试调整代码中 `headers.set("Host", targetHost)` 的逻辑，或确认目标网站重定向规则。
