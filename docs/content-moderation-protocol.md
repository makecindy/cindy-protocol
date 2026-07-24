# 内容审核签名协议

`@cindy/content-moderation-protocol` 定义 Cindy 客户端与内容审核签名服务之间的共享
wire contract。包只包含类型、常量与运行时解析器，不包含运行时依赖，也不持有平台
`app_id`、`app_secret` 或网关签名实现。

## 路由

客户端只请求 Cindy 自有签名服务：

- `POST /api/moderation/sign/json`：为审核提交或流式输出任务创建请求签名。
- `POST /api/moderation/sign/upload`：为图片直传创建请求签名。

签名服务只允许以下平台逻辑路径：

- `/api/v1/review/submit`
- `/api/v1/review/stream/tasks`
- `/api/v1/upload/direct`

调用方必须使用签名响应中的 `gateway_base_url`、`logical_path`、请求头及上传 query，
不得自行拼接平台凭据。

## JSON 签名请求

`ModerationJsonSignRequest` 包含：

- `logical_path`：审核提交或流式输出任务创建路径。
- `body`：将原样发往平台的 JSON 字符串；签名服务会按 `logical_path` 再次解析和校验。

审核提交正文使用 `ModerationSubmitBody`。`business_code` 仅允许：

- `maker-input-t2t`
- `maker-input-t2m`
- `maker-avatar`
- `maker-nickname`
- `maker-sys-prompt`

`items` 中每项包含 `type`（`TEXT` 或 `IMAGE`）、非空 `data` 和非空 `content_id`。

流式输出任务使用 `ModerationStreamCreateBody`，`business_code` 固定为
`stream-output`，`items` 固定为空数组。

两类正文都包含非空 `data_id` 和 `user_info.user_id`，可选 `extra` 只允许
`scene`、`agentKind`、`modelId`。

## 上传签名请求

`ModerationUploadSignRequest` 必须是空对象。成功响应包含固定上传路径、服务端生成的
`folder` query 和签名请求头；上传请求不得设置 JSON `Content-Type`。

## 响应与错误

JSON 签名响应使用 `ModerationSignedJsonResponse`，上传签名响应使用
`ModerationSignedUploadResponse`。两者都要求非空网关地址、白名单逻辑路径和完整签名头。
错误响应统一为：

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid signing request"
  }
}
```

## 兼容性与演进

这是新增协议包，不改变既有协议。未升级的客户端不会请求新签名端点，旧服务端也不会
消费该包；因此无需提升其他协议版本。新增业务码、路由、字段或改变校验语义时，必须同步
更新类型、runtime parse、round-trip/坏帧测试和本文档。消费方应先升级协议仓，再更新
submodule 指针和适配代码。
