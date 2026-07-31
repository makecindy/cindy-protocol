# Model Access 模型目录协议

`@cindy/model-access-protocol` 是客户端与 model-access-server 共享的模型目录
HTTP wire contract，覆盖 `GET /api/model-access/models` 的成功响应，以及匿名公共
Catalog 中可选的 `modelRegistry` 段。

## 版本

当前 `MODEL_ACCESS_CATALOG_SCHEMA_VERSION = 1`。成功响应必须携带
`schemaVersion: 1`；显式不支持的版本由消费者拒绝，避免把未知字段语义静默解释为
旧协议。

## 响应

```json
{
  "schemaVersion": 1,
  "models": [
    {
      "id": "example-chat-model",
      "currency": "CNY",
      "agents": ["claude-code", "codex"],
      "inputCostPerToken": 0.000001,
      "outputCostPerToken": 0.000002
    }
  ]
}
```

- `currency` 是每个模型必填的 ISO 4217 币种，目前允许 `CNY` / `USD`。
- 所有价格字段均使用同一条目的 `currency`，并保留服务端下发的 per-unit 原值；
  消费者不得根据 UI 语言、系统地区或登录区域自行推断币种。
- `agents` 是模型支持的 runtime tab，当前允许 `claude-code` / `codex`。
- 价格、展示元数据、token 上限和 per-agent 覆盖均为可选字段。

## Schema version 2 草案

v2 新增模型目录 resolve 契约，同时保持 v1 的所有导出和字段不变（append-only）。
`MODEL_ACCESS_RESOLVE_SCHEMA_VERSION` 为 `2`，effort 词表为
`minimal` / `low` / `medium` / `high` / `xhigh` / `max` / `ultra`，agent 词表为
`claude-code` / `codex`。

### Resolve request

```json
{
  "schemaVersion": 2,
  "entries": [
    {
      "providerId": "openrouter",
      "agent": "codex",
      "wireProtocol": "openai-responses",
      "models": [
        {
          "id": "vendor-model-id",
          "name": "Vendor display name",
          "providerReported": {
            "contextWindow": 200000,
            "maxOutput": 8192,
            "modalities": { "input": ["text"], "output": ["text"] },
            "capabilities": { "reasoning": true },
            "mode": "chat",
            "type": "chat"
          }
        }
      ]
    }
  ]
}
```

`providerReported` 是上游事实提示，不是客户端目录元数据。未知模型必须照样进入
request，服务端不能因为知识库没有匹配而过滤它。

### Resolve response

```json
{
  "schemaVersion": 2,
  "knowledgeRevision": "models-dev-2026-07-31",
  "entries": [
    {
      "providerId": "openrouter",
      "agent": "codex",
      "models": [
        {
          "id": "vendor-model-id",
          "name": "Vendor display name",
          "description": "…",
          "family": "…",
          "group": "gpt",
          "category": "gpt",
          "mode": "chat",
          "sortOrder": 10,
          "contextWindow": 200000,
          "maxOutput": 8192,
          "efforts": ["low", "medium", "high"],
          "defaultEffort": "medium",
          "effortDisplayNames": { "high": "High" },
          "supportsFastMode": true,
          "modalities": { "input": ["text"], "output": ["text"] },
          "capabilities": { "reasoning": true, "toolCall": true },
          "cost": { "input": 1, "output": 2 },
          "releaseDate": "2026-07-31",
          "status": "active",
          "defaultEnabled": true,
          "provenance": "knowledge-base"
        }
      ]
    }
  ]
}
```

`ResolvedModel` 的字段语义与客户端 `CatalogModel` 对齐。`id` 是 provider 上报的稳定
模型 id，resolve 绝不改写它；`provenance`（可选）只能是 `provider`、`override`、
`knowledge-base` 或 `default`。未知模型必须透传，并用保守默认补齐必需字段。

### ListModels v2

Cindy AI 的现有 `GET /api/model-access/models` 信封采用加性 v2 扩展：仍然是
`{ models: [...] }`，现有字段永不改名、改语义或删除，另加 `schemaVersion: 2` 和
`ResolvedModel` 的增量字段。`currency` 继续必填；已核实旧客户端不读取该字段，因此
此要求对旧客户端安全。空数组表示确实没有模型，不能解释成“未知”或回退为上一份目录。

### 契约不变量与消费失败语义

1. 未知模型必须透传；服务端绝不改模型 id，alias 只用于服务端内部知识库匹配。
2. 聊天模型的 `mode` 只能是 `chat` / `responses`，或省略；未知 mode 不得作为聊天
   模型发送。
3. 版本演进只允许 append-only。旧客户端红线是 `{models:[...]}` 信封以及现有字段的
   名称和语义永不改删；空数组是“真无模型”。
4. v2 parser 是严格逐字段校验器。消费方收到 `ok: false` 时必须拒收本次 payload，
   保留上一份有效快照，**绝不能清空列表**。HTTP 请求失败也沿用该策略；只有解析成功且
   明确为 `models: []` 时，才可把目录更新为空。

## 兼容与发布顺序

v1 是该 HTTP 响应首次纳入共享协议。新增 `schemaVersion` 和 `currency` 对旧客户端是
append-only：旧客户端忽略未知字段并继续使用原有模型目录。依赖 v1 的新客户端只在
服务端已部署 v1 后发布；若缺少 `currency` 或版本不受支持，解析器拒绝响应，客户端
应保留上一份有效目录，而不是猜测币种。

后续新增可选字段可在 v1 内 append-only 演进；修改既有字段语义、移除字段或扩展闭合
枚举时必须评估并升级 schema version。

## 公共 modelRegistry

`modelRegistry` 是 provider-independent 的模型定义和参考价控制面，作为可选顶层字段
嵌入 `GET /api/model-catalog/catalog` 返回的同一份 Catalog JSON：

```json
{
  "modelRegistry": {
    "schemaVersion": 1,
    "updatedAt": "2026-07-31T00:00:00.000Z",
    "models": [
      {
        "id": "openai/gpt-example",
        "name": "GPT Example",
        "contextWindow": 200000,
        "routes": [
          {
            "providerId": "openai",
            "modelId": "gpt-example",
            "agents": ["codex"],
            "referencePrices": [
              {
                "currency": "USD",
                "variant": "standard",
                "inputPerMtok": 1,
                "outputPerMtok": 5,
                "effectiveFrom": "2026-07-01",
                "source": {
                  "kind": "provider-official",
                  "url": "https://provider.example/pricing",
                  "verifiedAt": "2026-07-31"
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

- `id` 是 Cindy 稳定的规范模型 id；`routes` 映射供应商实际接受的 model id 和 runtime。
- 动态模型发现与 AIGateway 仍分别决定“当前是否可用”和 XD 的实际可售价格；
  `modelRegistry` 不得把静态条目解释成可用授权，也不得覆盖 Gateway 实价。
- 参考价格统一为每百万 token，可按输入 token 区间和生效日期声明多档价格。消费者
  仅选择当前有效且命中输入区间的条目；无匹配价格就不估价，不猜测。
- `updatedAt` 必须是 `Date#toISOString()` 形式的规范 UTC 时间戳。同一路由、同币种、
  同 variant 的价格不能同时在生效日期与输入 token 区间上重叠；区间上界均为 exclusive，
  因此相邻档位合法，依赖数组顺序消歧的配置会被整份拒收。
- 每个参考价必须带官方 HTTPS 来源和最近核验日期。它表达第三方公开牌价估算，
  不是用户账户的实际账单。
- 旧客户端忽略整个可选段；新客户端遇到未知 registry 版本或非法内容时保留上一份
  有效 registry，并继续使用 bundled fallback。

协议包与本仓其余协议包一致，以 TypeScript 源码直发：公开入口直指 `src/*.ts`，
仓库内不产出也不提交构建产物。源码内部沿用显式 `.js` 扩展名（与 plugin-protocol、
skill-protocol 一致），以满足消费方 `moduleResolution: node16` 的类型检查。

纯 Node 生产进程不能直接加载 `node_modules` 下的 TypeScript，因此服务端消费方必须
在构建期把本包内联进自己的 bundle（`tsup` 的 `noExternal`，与 device-link-server、
plugin-server 同一做法），运行时形态仍是 `node dist/index.js`。

客户端消费方由 Vite / Metro 直接吃源码。Metro 不会把 `./x.js` 回落到 `./x.ts`，
因此 mobile 侧需在 `metro.config.js` 的 resolver 中覆盖本包（desktop 的 Vite 与
vitest 自带该回落，无需配置）。
