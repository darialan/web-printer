# Contributing

## 环境

- Node.js 18+（与 CI 的 Node 22 保持一致即可）
- npm（仓库提交了 `package-lock.json`，请使用 `npm ci`）

```sh
npm ci
npm start        # 启动本地工作台（demo + landing）
```

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 全项目 TypeScript 检查 |
| `npm run test:lib` | 只跑 npm 包（`src/lib`）的单元测试 |
| `npm run test:once` | 跑全量单元测试（含 demo / landing） |
| `npm run test:e2e` | Playwright 浏览器测试（首次需 `npx playwright install chromium`） |
| `npm run build:lib` | 构建 ESM / CJS / `.d.ts` 到 `dist/` |
| `npm run check` | `typecheck` + `test:lib`，提交门禁 |
| `npm run check:full` | 全量单测 + 库/站点构建 + e2e |
| `npm run benchmark` | 对比 2.0.0 / 当前代码 / html2pdf.js，默认各运行 3 次 |
| `npm run benchmark:serve` | 打开 `/benchmark/index.html` 使用实验台 |

## 提交前

仓库使用 `.githooks/pre-commit`，克隆后执行一次：

```sh
npm run setup:hooks
```

钩子会运行 `npm run check`。如果修改了 landing 或 demo，请额外跑对应测试或 `npm run check:full`。

## 依赖与运行环境

- 无服务端依赖：分页、截图与组装全部在浏览器内完成。
- 可选 React 16.8+：仅 `/react` 入口使用。
- 现代浏览器：需要 Canvas 2D、Range 与 Font Loading API。

## 源码结构

```text
src/lib/
├── core/          # 纯函数：分页、几何、规则（无 DOM 依赖）
├── adapters/      # DOM 测量、快照、Canvas 截图、jsPDF
├── application/   # 流水线编排、导出服务、打印会话、取消
├── output/        # PDF / PNG writer、ZIP、页码
├── hooks/         # React 集成（仅 /react 入口）
└── overlay/       # 分页线可视化调试
```

仓库顶层：`src/demo/` 工作台示例、`src/landing/` 落地页、`e2e/` Playwright 端到端用例、`benchmark/` 同一批 HTML 的三引擎视觉与性能对照、`docs/` 对外文档、`assets/readme/` README 视觉资产。

依赖方向严格单向：`demo / ui → application → adapters + core`，不要反向 import；`src/lib/core` 保持纯计算，不依赖 DOM、React 或第三方库。

新增输出格式时实现 `OutputWriter` 并注册到 `output/index.ts`；分页、快照和截图链路不需要按格式分支。

## 文档

仓库只有两处放文档，不要混放：

- `docs/`：对外资产，接入方与 npm 用户可见（接入指南、迁移说明、输出层说明）。
- `.agents/docs/`：内部规则与经验，只放代码里看不出来的内容（发布流程、文档规则、供应商选择、缺陷台账），不放架构与实现。

agent 从根目录 `AGENTS.md` 进入，人类从 [`CONTRIBUTING.md`](CONTRIBUTING.md) 进入，两边都指向 [`.agents/docs/README.md`](.agents/docs/README.md)。

改动 API、默认值、规则或支持边界时，同一个提交内更新 `docs/` 下对应文档：

- 文档分组、事实来源与发版前检查清单：[.agents/docs/documentation.md](.agents/docs/documentation.md)
- 接入指南：[docs/npm-package-guide.md](docs/npm-package-guide.md)
- 发布流程：[.agents/docs/publishing.md](.agents/docs/publishing.md)

## 发布

见 [.agents/docs/publishing.md](.agents/docs/publishing.md)。发布前至少确认：

```sh
npm run check:full
npm pack
node scripts/verify-package.mjs ./darialan-web-printer-<version>.tgz
```
