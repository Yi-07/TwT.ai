# TwT.ai

受 claude.ai 启发的多模型 AI 聊天前端。支持 Claude、DeepSeek、ModelScope 及自定义 OpenAI 兼容供应商，内置 Artifact 系统（React / HTML / SVG 沙箱渲染）、双主题、跨设备持久化。

[English](README.en.md) 

![演示](ThemeSwitch.gif)

## 特性

- 多模型切换，支持自定义 OpenAI 兼容供应商，无需改代码
- 流式响应，AST 增量渲染，Artifact 系统内嵌渲染交互式 React / HTML / SVG
- KaTeX 数学公式渲染
- 双主题（暖白 / 午夜），对话历史 IndexedDB 持久化
- 可选 PostgreSQL 服务端存储，支持多设备同步
- 复制 / 编辑 / 重试用户消息，结构化输入卡片（`<ask_user>`）

## 快速开始

**依赖：** Node.js >= 20，pnpm >= 9

```bash
git clone https://github.com/Yi-07/TwT.ai.git
cd TwT.ai
pnpm install
cp .env.example .env.local   # 填入 API 密钥
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 配置

所有选项见 [.env.example](.env.example)。常用项：

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `DASHSCOPE_API_KEY` | ModelScope |
| `CUSTOM_PROVIDERS` | 自定义供应商 JSON 数组（见下） |
| `NEXT_PUBLIC_DEFAULT_PROVIDER` | 默认供应商 |
| `NEXT_PUBLIC_DEFAULT_TEMPERATURE` | 默认温度 |
| `NEXT_PUBLIC_DEFAULT_MAX_TOKENS` | 默认最大输出 token |

**自定义供应商：**

```bash
CUSTOM_PROVIDERS=[{"id":"groq","name":"Groq","type":"openai-compatible","apiKey":"gsk_xxx","baseUrl":"https://api.groq.com/openai/v1","model":"llama3-70b-8192"}]
```

重启 `pnpm dev` 即可生效。

## 部署

### Vercel

推送到 GitHub，在 Vercel 导入仓库并添加环境变量，自动部署。

### 跨设备同步（可选）

在 [Neon](https://neon.tech) 创建数据库，执行建表：

```sql
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

添加环境变量：

```bash
NEXT_PUBLIC_STORAGE_MODE=server
ACCESS_SECRET=<随机字符串>
NEXT_PUBLIC_ACCESS_SECRET=<与上相同>
DATABASE_URL=postgres://...
```

### 生产锁定

```bash
ACCESS_PASSWORD=你的密码     # 访问密码保护
NEXT_PUBLIC_DEBUG=false      # 关闭调试工具
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand v5 |
| Markdown | react-markdown + remark-gfm + remark-math |
| 数学渲染 | KaTeX + rehype-katex |
| 包管理器 | pnpm |

架构与贡献指南见 [CLAUDE.md](CLAUDE.md)。

## 许可证

MIT
