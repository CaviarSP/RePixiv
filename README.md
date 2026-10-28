# RePixiv GitHub Pages 前端

包含 `index.html`、`style.css`、`app.js`。可直接上传到 GitHub Pages 仓库根目录。默认演示模式可用于检查页面和交互；正式接入后端需修改 `app.js` 顶部的 `API_BASE` 并设置 `DEMO_MODE: false`。

## QQ 链接格式

建议使用 URL 片段，避免密钥随页面请求发送给静态站点：

`https://caviarsp.github.io/RePixiv/#key=YOUR_KEY`

代码也兼容 `?key=YOUR_KEY`。片段不会自动发送给 GitHub Pages，但前端会通过 HTTPS POST 把密钥发送给 Worker。请使用至少 32 字节密码学安全随机密钥的 Base64URL 表示，不要使用短密码。

## Worker API 契约

### POST `/api/gallery`
请求 JSON：`{"key":"YOUR_KEY"}`

响应 JSON 示例：
```json
{
  "title": "我的图片集",
  "description": "说明",
  "images": [
    {"id":"image-001","name":"图片 1","mimeType":"image/jpeg"},
    {"id":"image-002","name":"图片 2","mimeType":"image/png"}
  ]
}
```
Worker 用 key 查询 Python 后端的 `key -> image URL list` 映射，但只向前端返回图片 ID、名称、MIME 类型，不返回原始 URL。

### POST `/api/image`
请求 JSON：`{"key":"YOUR_KEY","imageId":"image-001"}`

响应为二进制 `application/octet-stream`，格式：
`RPX1`（4 ASCII 字节）+ `IV`（12 随机字节）+ `AES-GCM ciphertext || 16-byte tag`。

前端按如下规则派生 AES 密钥：`SHA-256(UTF-8(key))`，再将 32 字节摘要导入 AES-GCM。Worker 必须使用完全相同的规则。每次加密都必须使用新的随机 12 字节 IV，标签长度 128 bit。

## Worker / Python 安全要求

- Worker 先用 key 查询 Python 后端，确认图片集存在，再检查 `imageId` 确实属于该集合。
- 图片 URL 由服务端可信配置决定，禁止客户端提交任意 URL；仅允许指定图片源站和路径，限制重定向、MIME、响应大小，避免 SSRF。
- 不要在日志里记录请求体中的 key。启用 HTTPS、限速和合理的错误响应。
- Worker CORS 精确允许前端 Origin，允许 `POST, OPTIONS` 和 `Content-Type`；不要使用通配 Origin。
- 当前前端不使用 Cookie 会话，key 本身就是访问凭证。若要强制浏览器登记，需要额外增加会话验证。
- 图片解密成功后，明文对浏览器可用；此方案无法阻止已获授权的浏览器环境截取明文。
