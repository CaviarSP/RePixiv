# RePixiv GitHub Pages 前端

包含 `index.html`、`style.css`、`app.js`，上传到 `CaviarSP/RePixiv` 的
GitHub Pages 即可。

## 链接格式

补发按钮链接：

`https://caviarsp.github.io/RePixiv/#key=<64位十六进制密钥>`

密钥只放在 URL Fragment，不会随页面请求发送给 GitHub Pages。前端会
把它通过 HTTPS POST 发给 Worker。

首次使用需要先登记。QQ 里的【登记】按钮会打开：

`https://caviarsp.github.io/RePixiv/#t=<一次性令牌>`

登记表单就在本前端里（`#register`）：输入密码后前端直接 POST
`/api/register`，把返回的 Bearer token 存入
`localStorage["repixiv.session"]`，不需要跳到其他域名。之后请求 Worker
时带 `Authorization: Bearer <token>`。同一个 `caviarsp.github.io` 下
所有 Pages 共享这个键，其他 Pages 不要读取它。

登记与看图使用同一个页面和同一个浏览器存储，这是 QQ 内置浏览器能直接
完成整条流程的关键；Worker 自带的 `/register` 页仍保留，但设置了
`frame-ancestors 'none'`，在 QQ 里可能被要求用外部浏览器打开。

## 大图查看

点击主视图图片会打开覆盖整个视口的黑色大图层：图片用 `object-fit:
contain` 自适应屏幕的长边或宽边。大图层支持：

- 左右按钮切换上一张 / 下一张
- 手机左右滑动切换
- 键盘 `←` / `→` 切换，`Esc` 或点击图片外的黑色区域关闭
- 底部显示图片名和 `当前 / 总数`

切换时主视图、缩略图高亮和大图保持同步；已解密过的图片直接复用
`blob:` URL，不会重复请求 Worker。

## Worker API 契约

### POST `/api/gallery`

请求：`{"key":"<64位hex>"}`

响应：

```json
{
  "title": "发送失败的图片",
  "description": "共 2 张图片",
  "expiresAt": 1760604800,
  "images": [
    {"id":"im_...","name":"原图 1","mimeType":"image/jpeg"}
  ]
}
```

不返回原图 URL。

### POST `/api/image`

请求：`{"key":"<64位hex>","imageId":"im_..."}`

响应为二进制：

`RPX1`（4 ASCII 字节）+ `IV`（12 字节）+ `AES-GCM ciphertext || 16 字节 tag`

AES-256-GCM 的 key 是 64 位 hex 直接解码出的 32 字节原始密钥，
**不再做 `SHA-256(key)` 派生**。每次加密使用新的随机 12 字节 IV，
tag 长度 128 bit。

## 安全要点

- 两个 `/api` 接口都需要 Bearer 会话；Cookie（`__Host-rp_session`）
  只作为兼容路径。
- Worker 只抓取 bot 字典里的 `https://pillusts.caviarsp.top` 地址，
  不接受客户端 URL / path。
- 响应不包含原图 URL；前端只拿到密文和展示元数据。
- 明文在浏览器解密后仍然可被已授权用户截取，这一点无法仅靠前端避免。
- 若把前端部署到 GitHub Pages 自定义域，必须同步修改 Worker 的
  `ALLOWED_ORIGINS`。
