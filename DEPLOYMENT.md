# Typinglish 免费内测部署

本方案使用一个 Render Web Service 同时提供网页和 API，另配一个 PostgreSQL 数据库。访问者只需要一个网址。配置在 `render.yaml`。

## 发布步骤

1. 在 https://dashboard.render.com/ 用 GitHub 登录。
2. 创建 Blueprint，选择 `jiaxiner777/Typinglish` 仓库，以及包含本文件和 `render.yaml` 的部署分支（首次准备分支为 `codex/render-beta-deployment`）。
3. 使用仓库根目录的 `render.yaml`。服务和数据库都已明确配置为 `free`，地区为 Singapore。确认页面仍然显示免费资源后再创建。若当前账号不能使用免费资源，停止并重新选择方案。
4. 等待数据库及网页服务创建完成。构建命令会安装锁定依赖、检查类型并生成网页和后端；启动命令会先初始化数据库，再启动服务。
5. 在 Web Service 页面取得实际的 `onrender.com` 网址。不要把数据库连接地址发给试用者。

初次运行会导入仓库里的练习内容，不会导入演示用户或演示成绩。以后重启或部署，会保留管理员修改过的内容、已删除的内容状态和用户进度。初始化失败会回滚，可以重新部署重试。

## 内容管理员

Render 会自动生成 `ADMIN_TOKEN`。在服务的 Environment 页面查看该值，由你自己保存。打开网站的 `/admin` 页面，输入该密钥。

- 普通注册用户不会获得后台权限。
- 密钥仅在当前管理页面的内存中使用，刷新、关闭页面或点击“锁定后台”后需要重新输入。
- 不要把密钥发给试用者、写入 GitHub、放进 `VITE_*` 变量，或分享包含密钥的截图。
- 更换密钥：修改 Render 中的 `ADMIN_TOKEN` 并重新部署。原密钥立即失效于新部署。

## 配置

| 配置 | 值 |
| --- | --- |
| Node.js | 22.x（由 package.json engines 指定） |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm run start:production` |
| Health check | `/api/v1/health` |
| NODE_ENV | `production` |
| DATABASE_URL | Blueprint 自动引用数据库的内部连接地址 |
| ADMIN_TOKEN | Blueprint 自动生成随机值 |
| VITE_API_BASE_URL | 线上不设置，网页自动请求当前网址 |
| CORS_ORIGIN | 同源部署不需要设置 |

不要把本地 `.env` 上传到 Render 或 GitHub。线上数据库仅允许平台内网访问。自动部署默认关闭，需要更新时使用 Manual Deploy，避免其他开发提交立即影响试用者。

## 发布后验收

1. `/api/v1/health` 返回 `ok: true` 且 `mode: postgres`。
2. 未登录用户能看到内容并完成一次练习。
3. 注册账号后完成一个 Adventure 关卡；退出并重新登录，进度仍然存在。
4. `/admin` 显示管理密钥输入框；缺少密钥或密钥错误时，管理接口拒绝访问。
5. 换一台电脑和试用者常用的网络，确认网址可以打开。

## 免费方案期限

Render 免费 Web Service 空闲时会休眠，再次打开可能需要等待启动。免费 PostgreSQL 在创建 30 天后到期，不能把本方案当作长期免费数据库。请在到期前决定导出数据迁移或升级；本配置不会自动升级为付费计划。

官方说明：https://render.com/docs/free

## 本地验证

```bash
npm ci
npm test
npm run build
```

测试覆盖管理员接口隔离、同源网页路由、账号和进度，以及使用 PGlite PostgreSQL 引擎执行的初始化、重复运行和失败回滚。云平台的实际网络、资源创建及最终公开网址仍需在部署完成后验证。
