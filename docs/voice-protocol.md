# voice-protocol

`@cindy/voice-protocol` 是 desktop、mobile 与 voice-server 之间语音控制面的单一协议来源。包以 TypeScript 源码直发、零运行依赖，并保持 React Native 可编译。

## 协议边界

协议包负责 Cindy 自有且服务端需要解析的线上契约：

- `POST /api/voice/sessions` 的会话申请与响应；
- 一次性 ASR ticket、过期时间和 WebSocket 目标描述；
- `protocolProfile`、客户端类型与 refiner schema 等枚举；
- `POST /api/voice/sessions/:sessionId/refine` 的请求信封；
- 听写优化、词典学习两种 user payload；
- `{ error: { code, message } }` 错误信封和稳定路由构造器。

以下内容不属于本包：

- 豆包、Qwen、OpenAI 等上游的原生 WebSocket 帧；voice-server 对这些帧保持透明代理；
- Gateway API Key、JWT/JWKS 实现、Redis ticket 存储结构；
- 数据库、限流、计费和 provider/model allowlist。

## 版本与兼容性

当前 `VOICE_PROTOCOL_VERSION` 为 `1`。首次滚动接入期间，请求与响应里的 `protocolVersion` 为可选字段：缺省按 v1 解释，显式值只接受 `1`。这样新 server 可以先增加字段而不影响旧客户端，新客户端也能读取尚未升级的旧 server 响应。

协议演进遵循 append-only：新增可选字段时旧端忽略未知字段；修改已有字段语义、删除字段或收紧必填约束属于不兼容变更，必须升级版本并同步安排两个消费仓的升级窗口。

## 运行时校验

两端必须通过包内 parser 处理不可信输入：

- `parseCreateVoiceSessionRequest`
- `parseCreateVoiceSessionResponse`
- `parseVoiceRefineRequest`
- `parseVoiceRefinerUserPayloadJson`
- `parseVoiceErrorResponse`

解析失败返回 `{ ok: false, error }`，错误文本包含字段路径，不抛异常。业务层再把解析错误映射为本服务的 HTTP 错误码。

`parseVoiceRefinerUserPayloadJson` 在 `JSON.parse` 前先按 `VOICE_MAX_REFINER_PAYLOAD_CHARS`(64k 字符，与 refine 请求信封中 user message content 的上限一致）拒收超长原始输入——协议层的粗防 OOM 兜底；传输/部署层的 body 限额仍应独立设置。

Refiner 的业务 payload 使用严格字段集合，避免项目 Key 被未登记任务滥用；会话请求与响应允许额外字段，以支持 append-only 的滚动升级。
