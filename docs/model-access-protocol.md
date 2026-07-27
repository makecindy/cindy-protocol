# Model Access 模型目录协议

`@cindy/model-access-protocol` 是客户端与 model-access-server 共享的模型目录
HTTP wire contract，覆盖 `GET /api/model-access/models` 的成功响应。

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

## 兼容与发布顺序

v1 是该 HTTP 响应首次纳入共享协议。新增 `schemaVersion` 和 `currency` 对旧客户端是
append-only：旧客户端忽略未知字段并继续使用原有模型目录。依赖 v1 的新客户端只在
服务端已部署 v1 后发布；若缺少 `currency` 或版本不受支持，解析器拒绝响应，客户端
应保留上一份有效目录，而不是猜测币种。

后续新增可选字段可在 v1 内 append-only 演进；修改既有字段语义、移除字段或扩展闭合
枚举时必须评估并升级 schema version。

协议包以 TypeScript 源码发布。Node16/NodeNext 消费方使用入口中的显式 `.js`
扩展名；Metro/React Native 消费方应像现有 `device-link` workspace 包一样，把该
协议包注册为 TS 源码包并配置 `.js` → `.ts` 的 resolver 映射，不应在协议包内提交
伪造的 JavaScript 构建产物。
