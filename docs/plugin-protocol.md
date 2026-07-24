# Plugin Protocol

`@cindy/plugin-protocol` 是 plugin-server 与未来 Desktop Plugin 客户端共享的零运行时依赖 TypeScript contract。它不是服务，也不负责运行时协议协商。

## 使用方式

主仓库通过 `cindy-protocol` submodule 和 pnpm workspace 引用本包：

```json
{
  "dependencies": {
    "@cindy/plugin-protocol": "workspace:*"
  }
}
```

所有公开类型、常量和校验器都从包根入口导入：

```ts
import {
  PluginProtocolError,
  parseGetPluginResponse,
  parseListPluginsResponse,
  parsePluginDownloadResponse,
  validateGhostManifest,
  type GhostManifest,
} from '@cindy/plugin-protocol';
```

## 边界

本包只包含：

- Ghost 包的 `ghost.json` 类型、格式常量和 `validateGhostManifest`；
- Desktop 消费的 Plugin 列表、详情与下载响应 DTO、枚举和解析器。

本包不包含服务端数据模型、管理 API DTO、Plugin 生命周期、受众策略、鉴权、对象存储、安装目录、启停状态、IPC、panel 布局或其他 Desktop 运行时逻辑。管理面尚无跨仓 TypeScript 消费方，相关类型由 plugin-server 本地维护；未来出现真实共享消费者时再抽取。

## 校验 Ghost manifest

读取并解析 `ghost.json` 后，把未知值直接交给校验器。校验器不抛异常，而是返回可判别联合类型：

```ts
const rawManifest: unknown = JSON.parse(ghostJsonText);
const result = validateGhostManifest(rawManifest);

if (!result.ok) {
  throw new Error(`ghost.json 不合法: ${result.reason}`);
}

const manifest: GhostManifest = result.manifest;
```

成功结果是只包含协议已知字段的规范化对象；`kind` 等有缺省语义的字段会被补齐。不要在校验前把 `unknown` 强转为 `GhostManifest`，也不要在服务端或 Desktop 另写一套 manifest 校验规则。

### Node Worker 凭证绑定

声明了 `node` 槽的插件可以通过 `node.secretBindings` 请求主机把用户凭证安全持久化，并仅在指定 Worker 入口和 JSON-RPC 方法同时命中时临时注入：

```json
{
  "settingsHtml": "settings.html",
  "slots": ["tool", "node"],
  "node": {
    "entry": "node/worker.cjs",
    "protocol": "json-rpc-stdio",
    "secretBindings": [
      {
        "key": "mail_code",
        "label": "Mail authorization code",
        "methods": ["account/connect", "mail/action"],
        "hint": "Use the provider-generated authorization code",
        "url": "https://mail.example.com/settings"
      }
    ]
  }
}
```

- 每个插件最多声明 4 条绑定，每条最多绑定 16 个方法；`key` 与 `network.secrets`、`network.connections` 共用命名空间。
- `settingsHtml` 必填，负责把凭证一次性写入宿主保险库；浏览器沙箱与 Agent 参数不得接触凭证明文。
- `entry` 可省略，省略时仅绑定 `node.entry`；显式值必须逐字命中 `node.entry` 或 `node.entries`。
- `mcp-stdio` 绑定不得占用宿主保留的 `initialize`、`notifications/initialized` 握手方法。
- `url` 仅接受不含内嵌用户名或密码的 HTTPS 地址。

这是 schema v2 的可选、追加字段，不改变未声明该字段的现有插件。旧版发布服务器会因严格的 `node` 字段白名单而拒绝包含该字段的包；因此发布顺序必须是协议仓合并、plugin-server 升级并部署，然后再发布使用该字段的插件。旧版客户端同样会拒绝安装而不会降级为不安全的明文传参。

## 解析客户端 HTTP 响应

HTTP 返回体必须先作为 `unknown` 解析，再交给对应解析器：

```ts
const list = parseListPluginsResponse(await listResponse.json());
const detail = parseGetPluginResponse(await detailResponse.json());
const download = parsePluginDownloadResponse(await downloadResponse.json());
```

- `parseListPluginsResponse`：解析分页列表摘要，不包含完整 manifest；
- `parseGetPluginResponse`：解析单个 Plugin 详情及当前 Release 的完整 manifest；
- `parsePluginDownloadResponse`：解析短期 HTTPS 下载地址及完整性元数据。

当前 Release 摘要可带 `icon` 元数据。它描述发布时从 `.cindy` 包中安全提取并独立存储的图标，而不是包内相对路径：

```ts
interface PluginIconMetadata {
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  url: string;
  expiresAt: string;
}
```

`icon` 为 `null` 表示 manifest 未声明图标，或服务端暂未提供图标对象。旧 v2 响应缺少该字段时解析器也规范化为 `null`，客户端应继续使用兜底图标；提供该字段时，URL 必须是短期 HTTPS 地址，MIME 必须为 `image/*`，并经过 SHA-256、大小和过期时间校验。

三个解析器校验失败都会抛出 `PluginProtocolError`，错误消息包含出错字段路径，调用方应把它视为服务端响应不兼容或损坏，不应继续安装或切换 Release：

```ts
try {
  const result = parseGetPluginResponse(await response.json());
  // 使用 result.plugin
} catch (error) {
  if (error instanceof PluginProtocolError) {
    // 停止本轮远程对账，保留现有本地安装。
  }
  throw error;
}
```

解析器返回的对象只保留协议已知字段。列表、详情和下载响应中的 SHA-256 必须是 64 位小写十六进制，字节数必须是正整数，时间必须是带毫秒的 UTC ISO 8601 字符串；下载地址只接受 HTTPS。下载响应不含 `schemaVersion`，因为它只会在列表或详情 envelope 已成功解析后请求。

## 字段语义

| 字段                  | 语义                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `Plugin.id`           | plugin-server 生成的永久资源 ID；用于详情、下载、分页和本地 managed marker，不等于包内名称。           |
| `ghostId`             | `ghost.json.id`；在同一 owner 内唯一，不同 Public、Organization、Personal owner 间允许相同。           |
| `scope`               | `public` 对任意已登录 Cindy 身份可用；`organization` 只对对应组织可用；`personal` 只对发布者本人可用。 |
| `organizationId`      | Organization 必须是非空组织 ID；Public 和 Personal 恒为 `null`。                                       |
| `defaultInstall`      | 对当前请求身份计算后的有效默认安装值；表示未安装时自动安装，不表示强制安装或强制启用。                 |
| `currentRelease`      | 服务端当前发布的唯一 Release；普通客户端看不到历史 Release。列表只含摘要，详情额外包含 manifest。      |
| `currentRelease.icon` | 当前 Release 的可直接展示图标元数据；为 `null` 时使用客户端兜底图标，URL 为短期授权地址。              |
| `nextCursor`          | 下一页游标；为本页最后一个 `Plugin.id` 或 `null`。                                                     |

`parseGetPluginResponse` 还会校验 `ghostId === manifest.id`、Release `version === manifest.version`，以及顶层 `name/description/author` 与当前 manifest 一致。调用方不能用 `ghostId` 合并不同来源的记录，应以 `Plugin.id` 标识服务端管理的安装实例。

## 版本

- Ghost manifest 当前只接受 `GHOST_MANIFEST_SCHEMA_VERSION=2`；
- Plugin HTTP list/detail envelope 当前只接受 `PLUGIN_API_SCHEMA_VERSION=2`；v2 将 `global` 替换为 `public` 并新增 `personal`；
- 两个版本号独立演进，不能相互替代。

校验器对未知字段保持宽容，对已知字段和值严格校验。新增可选字段不要求服务端和 Desktop 同时发布；破坏性格式变化必须提升对应 schema version。

未知字段只用于前向兼容，不会出现在校验后的返回对象中。消费方不得依赖当前版本未声明的字段。

## 兼容行为

plugin-server 上传 Release 时使用本包校验 `ghost.json`，不支持的 manifest 不得发布。客户端使用本包解析列表、详情和短期下载凭证；下载响应本身不重复 envelope 版本，客户端只会在成功解析本轮列表/详情后请求它。

未来 Desktop 接入远程 Plugin 后，下载只进入 staging。客户端不支持 manifest 版本时：

- 首次安装失败并提示当前 Cindy 版本不兼容；
- 更新失败时丢弃 staging，继续保留本地旧 Release；
- 不执行 final switch，也不更新本地 managed marker。

HTTP envelope 版本不支持时，客户端停止本轮远程对账并保留本地状态。本期不提供按客户端版本选择 Release、多 current Release、capability 上报或其他协商机制。

## 消费顺序

本期由 plugin-server 先消费该包。Desktop 的 submodule pointer、依赖和 manifest re-export 在后续客户端接入任务中统一修改，不要求与本次服务端交付处于同一发布窗口。
