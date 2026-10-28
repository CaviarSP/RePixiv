# RePixiv 前端

适用于现有仓库 `https://caviarsp.github.io/RePixiv/`。包含响应式画廊、触摸滑动、方向键切换、缩略图导航和演示画廊。

## 部署
把 `index.html`、`style.css`、`app.js` 上传到 GitHub 仓库 `RePixiv` 的 Pages 发布目录。如果 Pages 使用 `main / (root)`，就放在仓库根目录。提交后等待 Pages 自动发布。

先打开：
`https://caviarsp.github.io/RePixiv/?gallery=demo`

## 接入 Cloudflare Worker
编辑 `app.js` 顶部的 CONFIG：
```js
const CONFIG = {
  API_BASE: "https://你的-worker-域名",
  DEMO_MODE: false
};
```

后端约定：
- `GET /api/gallery/{galleryId}` 返回 JSON：
```json
{
  "id":"abc123",
  "title":"画廊标题",
  "description":"3 张图片",
  "images":[
    {"id":"img001","name":"001.jpg","thumbnailUrl":"/api/thumb/img001"},
    {"id":"img002","name":"002.jpg","thumbnailUrl":"/api/thumb/img002"}
  ]
}
```
- `GET /api/image/{imageId}` 返回图片二进制，且设置正确的 `Content-Type: image/jpeg`（或其他 `image/*` 类型）。401/403 表示未授权。
- 缩略图接口可选；没有 `thumbnailUrl` 时会显示编号占位缩略图。

前端使用 `credentials: "include"`，如使用 Cookie 会话，Worker 必须对 `https://caviarsp.github.io` 配置精确的 CORS Origin、`Access-Control-Allow-Credentials: true`，并正确响应 OPTIONS。不要使用 `Access-Control-Allow-Origin: *` 搭配凭据。

注意：默认 GitHub Pages 域名与自定义 Worker 域名可能涉及跨站 Cookie 限制，尤其是 QQ 内置浏览器。正式启用登记机制前需在目标浏览器实测；也可考虑给 Pages 绑定自有域名以改善同站点 Cookie 方案。

当前版本预期 Worker 返回浏览器可显示的图片字节，尚未实现特定加密二进制协议。若要使用浏览器端解密，需要先确定协议、密钥传递和授权流程，再修改 `app.js`。不要把长期密钥、管理令牌或源站凭据写入前端；GitHub Pages 的静态文件是公开可读的。
