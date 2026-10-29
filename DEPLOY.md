# 长文翻译助手 - 部署指南

## 快速部署到 Cloudflare Pages（推荐）

### 方法一：CLI 部署（最快）

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录 Cloudflare（会打开浏览器）
wrangler login

# 3. 一键部署
wrangler pages deploy dist --project-name=long-translator
```

部署成功后会获得链接：`https://long-translator.pages.dev`

### 方法二：Web 界面部署

1. 访问 https://dash.cloudflare.com
2. 注册免费账号
3. 左侧菜单 → Workers & Pages → Create application → Pages
4. 选择 "Upload assets" → 上传 `dist` 文件夹
5. 等待部署完成，获得公开链接

---

## 其他部署选项

### Vercel
```bash
npm i -g vercel
vercel --prod
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Zeabur（香港节点，国内快）
```bash
npm i -g @zeabur/cli
zeabur login
zeabur deploy
```

---

## 国内访问优化

### 1. 绑定自定义域名
- 在 Cloudflare 添加自定义域名
- 使用国内 DNS 服务商（阿里云、腾讯云）
- 开启 CDN 加速

### 2. 使用国内对象存储（需备案）
- 阿里云 OSS + CDN
- 腾讯云 COS + CDN
- 七牛云存储

### 3. GitHub Actions 自动部署

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install & Build
        run: |
          npm ci
          npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: long-translator
          directory: dist
```

---

## 性能对比

| 平台 | 国内速度 | 免费额度 | 部署难度 |
|------|---------|---------|---------|
| Cloudflare Pages | ⭐⭐⭐⭐ | 无限 | 简单 |
| Vercel | ⭐⭐ | 100GB/月 | 简单 |
| Netlify | ⭐⭐ | 100GB/月 | 简单 |
| Zeabur | ⭐⭐⭐⭐ | 有限 | 简单 |
| 阿里云 OSS | ⭐⭐⭐⭐⭐ | 需付费 | 中等 |

---

## 常见问题

**Q: 翻译 API 在国内能用吗？**
A: 谷歌翻译 API 国内可访问，百度翻译完全没问题，其他引擎需要科学上网或配置代理。

**Q: 需要备案吗？**
A: 使用 .pages.dev / .vercel.app 等域名不需要备案。使用国内域名（.cn/.com）+ 国内服务器需要备案。

**Q: 如何自定义域名？**
A: Cloudflare/Vercel 都支持绑定自定义域名，在设置中添加即可。

---

## 项目信息

- 构建产物：`dist/` 目录
- 构建命令：`npm run build`
- 类型：纯静态站点（无需后端）
- 大小：约 300KB（gzip 后）
