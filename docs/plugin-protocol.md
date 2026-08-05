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

### OAuth scope 数量上限

`network.secrets[].oauth.scopes` 最多包含 256 条；第 257 条会被
`validateGhostManifest` 拒绝。每条 scope 仍必须是 1–200 字符、不含空白的
唯一字符串，本变更不改变单条校验或重复项规则。

这是 schema v2 的宽松校验变更，不需要提升 manifest 版本。新版 plugin-server
可以发布 49–256 条 scope 的包；仍使用旧协议校验器的 Desktop 会拒绝安装这些包
并保留现有安装，因此应先升级客户端，再分发超过 48 条 scope 的 Plugin。

### Manifest 本地化资源

Plugin 可通过可选的 `locales` 字段声明宿主支持语言对应的包内 JSON 资源：

```json
{
  "locales": {
    "en": "locales/en.json",
    "zh-CN": "locales/zh-CN.json",
    "ja": "locales/ja.json",
    "ko": "locales/ko.json"
  }
}
```

- 支持语言固定为 `zh-CN`、`en`、`ja`、`ko`；声明 `locales` 时必须包含
  `en`，供宿主语言不受支持或目标资源缺失时回退。
- 每条值必须是包内安全相对路径并以 `.json` 结尾；不同语言不能复用大小写
  折叠后相同的路径，也不能与 `ghost.json`、入口、图标、设置页、面板、Node
  入口或 Skill 目录冲突。
- 单个 locale JSON 的大小上限由 `GHOST_LOCALE_MAX_BYTES` 固定为 64 KiB。
  包文件存在性、UTF-8 JSON 和资源内容由打包、发布及安装侧在读取制品时校验。
- 这是 schema v2 的可选追加字段，不需要提升 manifest 版本。旧消费方会按未知
  字段忽略并继续使用顶层文案；支持该字段的消费方按宿主语言读取资源。

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

### Host 托管的企业身份凭证

组织插件可以声明 `network.secrets[].source: "oidc-token"`，请求 Cindy
Desktop 为当前企业 Membership 按需签发短时 Connection JWT。令牌只在 Host
的 Main 进程内存中使用，插件代码和 Node Worker 都不能读取、保存或转交令牌：

```json
{
  "slots": ["network"],
  "network": {
    "hosts": ["api.example.com"],
    "secrets": [
      {
        "key": "cindy_identity",
        "label": "Cindy organization identity",
        "source": "oidc-token",
        "inject": {
          "header": "Authorization",
          "format": "Bearer {value}",
          "hosts": ["api.example.com"]
        }
      }
    ]
  }
}
```

该来源必须同时满足：

- `inject.hosts` 必须显式非空，并且每项是 `network.hosts` 中的精确域名；不接受通配符；
- `inject.header` 固定为 `Authorization`，`inject.format` 固定为 `Bearer {value}`；
- 不得声明 `input`、`url`、`exchange` 或 `oauth`，也不要求 `settingsHtml`；
- Plugin Server 只允许 `scope=organization` 的 Release 发布该来源；Public 和 Personal
  Release 必须拒绝。

这是 schema v2 的新增 manifest 能力，不改变未声明该来源的既有插件。旧版
plugin-server 或 Desktop 不认识该来源时必须拒绝发布/安装，并保留已有安装；部署顺序
应为先合并协议，再升级 plugin-server，最后发布支持正式 Market provenance 的 Desktop。

### Host 托管的 GitHub CLI 凭证

受信的 GitHub 插件可以声明 `network.secrets[].source: "gh-cli"`，请求
Cindy Desktop 优先使用本机 `gh auth token` 的登录令牌；本机未安装 `gh`、
未登录或读取失败时，回落到用户在该插件设置页保存的备用 Token。
两种令牌都由 Host 选择并注入，插件代码和 Node Worker 无法读取明文：

```json
{
  "settingsHtml": "settings.html",
  "slots": ["network"],
  "network": {
    "hosts": ["api.github.com"],
    "secrets": [
      {
        "key": "github_pat",
        "label": "GitHub login",
        "source": "gh-cli",
        "url": "https://github.com/settings/tokens",
        "inject": {
          "header": "Authorization",
          "format": "Bearer {value}",
          "hosts": ["api.github.com"]
        }
      }
    ]
  }
}
```

该来源必须同时满足：

- `settingsHtml` 必填，作为备用 Token 的写入、替换和清除入口；
- `inject.header` 固定为 `Authorization`，`inject.format` 固定为
  `Bearer {value}`；
- `inject.hosts` 必须且只能声明精确域名 `api.github.com`；
- 不得声明 `input`、`exchange` 或 `oauth`；`url` 可用于展示备用
  Token 的 HTTPS 申请入口；
- Plugin Server 与其他 source 一样只消费本 Protocol 的结构校验，
  不读取、解析或注入 GitHub 凭证；宿主凭证的信任、用户授权与运行期
  注入边界由 Desktop 的统一插件权限模型执行。

这是 schema v2 的新增 manifest 能力，不改变未声明该来源的既有插件。
旧版 plugin-server 或 Desktop 不认识该来源时必须拒绝发布/安装并保留已有
安装。部署顺序为：先合并协议，再升级并部署 plugin-server，然后发布支持
`gh-cli` 且接入统一插件权限模型的 Desktop，最后上架声明该来源的插件。

## 解析客户端 HTTP 响应

HTTP 返回体必须先作为 `unknown` 解析，再交给对应解析器：

```ts
const list = parseListPluginsResponse(await listResponse.json());
const detail = parseGetPluginResponse(await detailResponse.json());
const download = parsePluginDownloadResponse(await downloadResponse.json());
```

- `parseListPluginsResponse`：解析分页列表摘要与清理通告，不包含完整 manifest；
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

## 清理通告（removals）

列表响应可携带可选的顶层 `removals` 数组，通告「曾上架、现已下架并要求处置本地副本」的 Plugin。它与 `plugins` 互补：`plugins` 只含在架条目，被清理的 Plugin 不会回到列表里；detail 与 download 对被清理的 Plugin 维持 404。

```jsonc
{
  "schemaVersion": 2,
  "plugins": [],
  "nextCursor": null,
  "removals": [
    {
      "pluginId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "ghostId": "acme-report",
      "scope": "organization",
      "organizationId": "org_123",
      "action": "purge",
      "removedAt": "2026-08-03T08:00:00.000Z",
    },
  ],
}
```

- 这是 v2 的可选追加字段，不提升 `PLUGIN_API_SCHEMA_VERSION`。老服务端不下发、老客户端按未知字段忽略；解析器在字段缺失或为 `null` 时规范化为空数组。
- 服务端只对已验签的组织身份下发其所属组织的通告，与请求的 `scope` 查询参数无关；当前 `scope` 恒为 `organization`、`action` 恒为 `purge`（删除本地已安装副本及插件本地数据）。
- 分页时每一页都携带完整且相同的 `removals`，不受搜索关键字与游标影响；客户端聚合分页时按 `pluginId` 去重。
- 服务端保证单个响应内 `plugins` 与 `removals` 不含相同 `pluginId`，但跨分页请求期间状态可能翻转：客户端应在整轮分页完成后再应用通告；同一轮内某 `pluginId` 既出现在任一页 `plugins` 又出现在任一页 `removals` 时，以在架为准、不执行清理。
- `removedAt` 是最近一次下架时间，重新上架再下架会刷新；消费方不得据此假设单调或首次下架时间，去重与匹配一律以 `pluginId` 为准。
- `action` 是取值级前向兼容位：其结构形状固定为 1–64 字符的字符串，形状合法但取值未知的通告会被解析器跳过，不影响其余内容，服务端未来新增动作（动作名必须落在该形状内）不要求客户端同步升级；结构不合法（`pluginId`、`ghostId`、scope 一致性、`action` 形状、时间格式）仍抛出 `PluginProtocolError`。
- 通告不是无条件删除指令：客户端执行前必须与本地安装记录双重校验（`pluginId` 一致、来源为服务端市场、本地记录的 scope 为 `organization`），校验不过时最多把该 Plugin 标记为不可更新，不得删除本地内容。

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

`parseGetPluginResponse` 还会校验 `ghostId === manifest.id`、Release `version === manifest.version`、顶层 `name/description/author` 与当前 manifest 一致，以及声明 `oidc-token` 的 manifest 只能属于 `organization` scope。调用方不能用 `ghostId` 合并不同来源的记录，应以 `Plugin.id` 标识服务端管理的安装实例。

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

本期由 plugin-server 和 Desktop 共同消费该包。协议合并后，两个消费方仓库分别 bump
submodule 指针并在各自 PR 中完成适配；不能让任一方长期停留在只认识旧 manifest 的版本。
