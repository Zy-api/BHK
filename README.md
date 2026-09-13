# 国漫影视APP - 部署指南

## 项目结构

```
/
├── index.html          # 前端主页面（iOS风格影视APP）
├── vercel.json         # Vercel配置文件
├── api/
│   ├── home.js         # 首页推荐接口
│   ├── search.js       # 搜索接口
│   ├── detail.js       # 详情和播放地址接口
│   ├── image.js        # 图片代理接口
│   └── video.js        # 视频代理接口
└── README.md           # 部署说明
```

## 数据来源

- **主数据源**：星辰影院 (xcyycn.tv) - 国产动漫资源
- **封面图**：daquanz.com CDN
- **视频源**：多线路MP4直链

## 一键部署到Vercel

### 方法一：通过Vercel CLI部署（推荐）

```bash
# 1. 安装Vercel CLI
npm install -g vercel

# 2. 登录Vercel
vercel login

# 3. 部署（在项目根目录执行）
vercel --prod
```

### 方法二：通过GitHub部署

1. 将项目推送到GitHub仓库
2. 打开 [vercel.com](https://vercel.com)
3. 点击 "New Project" → 选择你的GitHub仓库
4. 保持默认设置，点击 "Deploy"

## API接口说明

部署成功后，你的API地址为：`https://你的域名.vercel.app/api`

### 1. 首页推荐
```
GET /api/home?type=guoman&page=1
```

### 2. 搜索
```
GET /api/search?wd=关键词&page=1
```

### 3. 视频详情和播放地址
```
GET /api/detail?id=2040
```

### 4. 图片代理
```
GET /api/image?url=图片URL
```

### 5. 视频代理
```
GET /api/video?url=视频URL
```

## 前端配置

部署后需要修改 `index.html` 中的API地址：

```javascript
// 找到这一行（约第1088行）
var API_BASE = '/api';

// 如果前端和API在同一个Vercel项目下，保持 '/api' 即可
// 如果分开部署，改为你的API地址：
var API_BASE = 'https://你的项目.vercel.app/api';
```

## 功能特性

- iOS风格毛玻璃导航栏
- 首页轮播Banner + 热播推荐 + 全部国漫
- 实时搜索（支持模糊搜索国漫）
- 真实动漫封面图
- 多播放线路切换
- 多集数选择
- HLS视频播放器
- 视频代理（解决CORS问题）
- 图片代理（解决防盗链问题）
- 收藏/历史记录/下载管理
- 主题切换
- iOS风格弹窗和Toast

## 注意事项

1. **视频播放**：部分视频源可能有防盗链，已通过后端代理解决
2. **CORS**：所有API接口已配置CORS允许跨域
3. **缓存**：图片代理已设置24小时缓存
4. **数据源**：如遇数据源失效，可在 `api/*.js` 中修改 `BASE_URL` 更换源站
5. **dongpian13.com**：该站有复杂的签名认证机制，暂未对接。如需要对接可联系提供签名算法

## 更换数据源

如果星辰影院访问不稳定，可以更换为其他MacCMS系统的站点：

1. 修改 `api/home.js`、`api/search.js`、`api/detail.js` 中的 `BASE_URL`
2. 确保目标网站也是相同的模板系统（URL格式：`/d-{id}.html`、`/s.html?wd=xxx`）

## 本地开发测试

```bash
# 安装vercel dev
npm install -g vercel

# 本地运行
vercel dev
```

然后访问 `http://localhost:3000`

## Netlify部署

同样支持Netlify部署，将 `api/` 目录改为 `netlify/functions/`，并配置相应的Netlify函数即可。
