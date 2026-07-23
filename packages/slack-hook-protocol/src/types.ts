/**
 * slack-hook-protocol/types.ts
 * ---------------------------------------------------------------------------
 * hook server <-> desktop 双工任务协议 v1 的全部类型定义。
 *
 * 协议模型(四幕):
 *   1. 连接自报家门: hello(desktop -> server, 声明工作区别名) / welcome / ping / pong
 *   2. 派活:        task.dispatch(server -> desktop) -> task.ack(立即三态应答)
 *   3. 干活:        无消息 —— 铁律「同 externalKey 同 session」由 desktop 侧保证
 *   4. 交差:        turn.end(desktop -> server, 结果回传)
 *
 * 关键约定:
 *   - externalKey 对协议是不透明字符串, 由 hook server 的 provider 生成
 *     (格式约定 `<providerId>:...`), desktop 只拿它查 session 映射并原样回传。
 *   - workspace 是别名(alias), 本地绝对路径只存在于 desktop, 永不过网线。
 *   - sessionId 仅「接管已有桌面会话」时由 server 显式指定; 普通流程不填,
 *     ack / turn.end 中回传仅作记录与调试, 不参与路由。
 *   - 可靠性: requestId 幂等(重投不重跑, 只回放上次 ack); 断线重连后
 *     server 重投未 ack 任务, desktop 补发未送达的 turn.end。
 *
 * v2 增量(版本号不变 —— type 为开放集合, 老端收到未知类型丢帧不断连):
 *   5. 绑定:   bind.start(desktop 发起) / bind.update(server 推状态) / bind.revoke
 *      —— 中心部署下「Slack 用户 ↔ 设备」的建立与解除。阶段 4 起改走
 *      Sign in with Slack(OIDC): desktop 发空 bind.start, server 签发授权
 *      链接经 bind.update(state=pending, authorizeUrl)回推, 用户在系统浏览器
 *      完成 Slack 授权后 server 回调建链, 再推 confirmed。协议只承载 desktop
 *      侧的发起与状态同步, 身份确认在 server 与 Slack 之间完成。
 *   6. 问答:   query.request(server -> desktop) / query.response —— /bind /model
 *      /effort 等指令触发时实时拉取工作区 / 模型清单, 不用连接期快照。
 *   7. 取消:   task.cancel(server -> desktop) —— /stop 中断在跑任务,
 *      desktop 以 turn.end(status=cancelled) 收口。
 *   8. 归档:   session.archive(server -> desktop) —— 私聊 /new 换代后通知
 *      desktop 归档旧代会话(按 externalKey 查绑定), 列表不再显示; 无绑定 /
 *      会话不存在时静默忽略(幂等)。
 *
 *   9. 进度:   turn.progress(desktop -> server) —— turn 执行中的渲染快照。
 *      历史: 初版只发裸累积文本, 体验不佳一度下线; 现已复活, desktop 侧
 *      合成「过程区时间线 + 部分正文」的完整快照(节流), server 侧以
 *      占位消息 + chat.update 原地刷新呈现。旧版 desktop 仍发裸文本快照,
 *      新 server 同样渲染(向后兼容); 旧 server 收到新帧静默丢弃(无害)。
 *
 *   10. 交互:  interaction.request(desktop -> server) / interaction.decision
 *      (server -> desktop) / interaction.cancel(desktop -> server) ——
 *      turn 执行中 agent 发起的用户交互(模型主动提问 AskUserQuestion /
 *      计划审阅 plan_review)以按钮卡片形式转发到 Slack thread。设计原则:
 *      **决策语义全部留在 desktop**(它持有 maker-core 的原始
 *      InteractionRequest 与按钮->决策映射), server 是"哑渲染器"——
 *      收到 request 渲染卡片, 按钮按压只回传 buttonId; desktop 侧对每个
 *      交互设超时, 超时/收口时按安全默认自决并发 cancel 让 server 改写
 *      卡片。旧 server 收到 request 丢帧不断连 -> desktop 超时默认继续,
 *      任务不会卡死(向后兼容)。权限审批(permission)已纳入本通道: server
 *      可经 dispatch options.permissionMode 为新建会话指定权限档(见
 *      TaskDispatchOptions), 非 bypass 档下 agent 的权限请求同样以按钮卡
 *      转发(允许一次 / 本会话总是允许 / 拒绝), 超时安全默认为拒绝。
 *
 *   11. 偏好:  prefs.get / prefs.set(desktop -> server) / prefs.state
 *      (server -> desktop) —— server 侧 user_prefs(按 (Slack 用户, 工作目录)
 *      的 agent/model/effort/permission 偏好, /model 卡的数据正本)的远程
 *      读写通道: desktop 设置页是同一份数据的编辑器。prefs.state 是全量
 *      快照, 既作为 get/set 的应答(replyTo 回显请求 id), 也在 /model 卡
 *      写入后主动推送(replyTo null; 设备离线静默丢, desktop 重连自拉)。
 *      旧 server 收到 prefs.get 丢帧不断连 -> desktop 侧超时降级为
 *      "服务器版本过旧"提示; 旧 desktop 收到主动 prefs.state 同样丢帧无害。
 *
 *   12. 工具:  tool.request(desktop -> server) / tool.response(server ->
 *      desktop) —— desktop 会话内 agent 调用 server 侧 Slack 网关工具
 *      (server 以绑定用户托管的 user token 调 Slack 官方 MCP / Web API)。
 *      方向与 query.* 相反: desktop 是请求方(pending map + 超时在 desktop
 *      侧), server 收到即执行并以 tool.response(replyTo 回显 requestId)
 *      应答。tool 名是开放集合(server 不认识回 UNKNOWN_TOOL), 错误一律
 *      结构化 {code, message} —— desktop 按 code 分支, 不解析文案(规则 9)。
 *      能力协商: 支持本帧族的 server 在 welcome.features 里带
 *      HOOK_FEATURE_SLACK_TOOLS; 旧 server 收到 tool.request 丢帧不断连,
 *      desktop 侧靠 feature 缺席短路 + 超时兜底(SERVER_TOO_OLD)。
 *
 *   13. 多 workspace 绑定(multi-team): 一台设备可同时持有多个
 *      (teamId, slackUserId) 绑定 —— 每个 Slack workspace(team)一条, 同
 *      team 内仍一设备一身份。能力协商双向: desktop 在 hello.features 带
 *      HOOK_FEATURE_MULTI_TEAM 声明自己会消费多绑定帧, server 在
 *      welcome.features 带同名标识声明支持; 任一侧缺席则整体回落单绑定
 *      行为(server 对旧 desktop 保持"跨 team 顶替"旧语义, 新 desktop 对
 *      旧 server 收起添加入口)。增量帧面:
 *        - bind.state(server -> desktop): 绑定全量快照(权威列表), 连接
 *          建立与任何绑定变化(新增/解除/被顶)后推送; 旧 desktop 不认识
 *          本类型, parse 拒收丢帧不断连。
 *        - bind.update 加可选 teamId: 事件帧按 team 定位(confirmed /
 *          revoked); 授权流早期(pending)团队未知, teamId 为 null。
 *        - bind.start 加可选 teamId: 给指定 team 重新授权时 pin 授权页;
 *          缺省 = 用户在 Slack 授权页自选(可绑任意新 team)。
 *        - bind.revoke 从空对象放宽为 { teamId?: string|null }: 带 team
 *          = 只解绑该 team; 空/缺省 = 解绑本设备全部(兼容老 desktop)。
 *          旧 server 对带 teamId 的帧 parse 拒收, 故 desktop 仅在 server
 *          声明 multi-team 后才发带 team 的形态。
 *        - prefs.set / prefs.state 条目 / tool.request 加可选 teamId:
 *          多绑定下偏好与网关工具的 team 归属消歧; 缺省语义 = 设备唯一
 *          绑定(多绑定时 server 拒绝猜测, 结构化报错)。
 *        - TaskSource 加 teamId / teamName: desktop 侧会话记住来源
 *          workspace(标题展示 + 工具调用默认 team)。
 */

/** 当前协议版本。信封 `v` 不等于本值的消息直接拒收。 */
export const HOOK_PROTOCOL_VERSION = 1;

/**
 * 单帧(JSON 序列化后)最大字符数。parse 对超长原始帧直接拒收 —— 纯粹是
 * 防 OOM 的粗防御, 不是业务限额。task.dispatch 可携带 base64 图片附件, 故取
 * 一个能容纳"几张聊天截图"的宽上限(48 MiB); 附件的精细限额(单图大小 /
 * 张数)由生产源头(provider)负责, 不依赖本值。非附件帧远小于此。
 */
export const HOOK_MAX_FRAME_CHARS = 48 * 1024 * 1024;

/** 消息类型全集(v1 七种 + v2 增量帧)。 */
export const HOOK_MESSAGE_TYPES = [
  'hello',
  'welcome',
  'ping',
  'pong',
  'task.dispatch',
  'task.ack',
  'turn.end',
  'turn.progress',
  'bind.start',
  'bind.update',
  'bind.revoke',
  'provider.bind.start',
  'provider.bind.cancel',
  'provider.bind.revoke',
  'provider.bind.update',
  'provider.bind.state',
  'query.request',
  'query.response',
  'task.cancel',
  'session.archive',
  'interaction.request',
  'interaction.decision',
  'interaction.cancel',
  'prefs.get',
  'prefs.set',
  'prefs.state',
  'provider.prefs.get',
  'provider.prefs.set',
  'provider.prefs.state',
  'tool.request',
  'tool.response',
  'bind.state',
] as const;

export type HookMessageType = (typeof HOOK_MESSAGE_TYPES)[number];

/**
 * 消息信封 —— 线上跑的每一帧都是这个形状。
 * `id` 是发送方生成的帧唯一标识(日志/去重用); 业务关联一律走 payload 里的
 * requestId, 不用 `id`。`ts` 是发送方时钟(unix ms), 仅供诊断, 不参与逻辑。
 */
export interface HookEnvelope<TType extends HookMessageType, TPayload> {
  v: number;
  type: TType;
  id: string;
  ts: number;
  payload: TPayload;
}

// ── 阶段 1: 连接与身份 ───────────────────────────────────────────────────────

/**
 * hello(desktop -> server): 建连后第一帧, 自报身份与能力。
 * 工作区别名映射变更后, desktop 重发 hello 即时生效(server 以最新一帧为准)。
 */
export interface HelloPayload {
  protocolVersion: number;
  /** desktop 设备稳定标识(多设备路由预留, v1 server 侧可只记录)。 */
  deviceId: string;
  deviceName: string;
  /** 本连接注册的工作区别名列表 —— server 只能派发列表内的别名。 */
  workspaces: string[];
  /** 可用 agent 类型(如 'cc' / 'codex'), 供 server 侧校验 dispatch options。 */
  agents: string[];
  /**
   * desktop 侧能力标识(可选, 缺省 = 旧客户端无能力)。当前已定义:
   * HOOK_FEATURE_MULTI_TEAM —— 会消费 bind.state 快照与按 team 定位的
   * bind.update / prefs.state。老 server 校验器只查已知字段, 本字段安全透传。
   */
  features?: string[];
}

/** welcome(server -> desktop): hello 的应答, 握手完成。 */
export interface WelcomePayload {
  serverName: string;
  /** server 侧启用的可选能力标识, v1 恒空数组, 预留。 */
  features: string[];
}

/** ping / pong: 心跳, 双向皆可发起, 收到 ping 必须回 pong。payload 恒空对象。 */
export type PingPayload = Record<string, never>;
export type PongPayload = Record<string, never>;

// ── 阶段 2: 派活 ─────────────────────────────────────────────────────────────

/**
 * dispatch 的可选 override。全部可空 —— 空值落到 desktop 连接配置的默认值。
 * permissionMode 语义: 仅对「新建 session」的任务生效 —— desktop 校验其属于
 * 目标 agent 的能力档位清单, 合法即用, 非法/缺省落 bypassPermissions;
 * 复用/接管已有会话时忽略(session meta 权威, 进行中的会话不受影响)。
 */
export interface TaskDispatchOptions {
  model?: string | null;
  permissionMode?: string | null;
  agentKind?: string | null;
  /** 思考强度档位(如 low/medium/high); 空 = desktop 按草稿默认落值。 */
  effort?: string | null;
}

/**
 * 入站附件(图片等), 随 dispatch 一起下发。base64 内联传输 —— 复用已建好、
 * 已鉴权的 WS 通道, 免去 desktop 再开 HTTP 拉取端点。desktop 侧解码落盘后
 * 以本地路径喂给 agent(maker 的 image content block 要 path 而非 base64)。
 * 精细限额(单图大小 / 张数)由 provider 在生产端把关, 见其实现。
 */
export interface TaskAttachment {
  /** 原文件名(落盘 / 提示用); 无则 desktop 按序号命名。 */
  name: string | null;
  /** MIME 类型(如 image/png)。 */
  mimeType: string;
  /** base64 编码的字节(不含 data: 前缀)。 */
  dataBase64: string;
}

/**
 * agent 多模态可消费的图片 MIME 白名单 —— 协议层的权威单一来源。
 * 与 desktop renderer 的 SUPPORTED_IMAGE_EXTS 一致, 也是 Claude / Codex vision
 * 实际接受的集合(png / jpeg / gif / webp)。provider 下载端与 desktop 落盘端
 * 都据此过滤: 一端宽一端窄会导致图片被下载/传输后在对端静默丢弃, 白费带宽还
 * 不告知用户。bmp / svg / heic / avif / tiff 等不在此列(上游 vendor API 不接受)。
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

/**
 * 判定 MIME 是否为 agent 可消费的图片类型(大小写 / 前后空白无关;
 * 常见别名 image/jpg 归一到 image/jpeg)。
 */
export function isSupportedImageMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (m === 'image/jpg') return true;
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(m);
}

/**
 * 结构化 thread 上下文条目(来源 IM 的 thread 历史中的一条消息)。
 * desktop 据此渲染可折叠的 thread 上下文卡片, 不再依赖从 prompt
 * 文本里正则解析 <thread_context> 块。
 */
export interface ThreadContextEntry {
  author: string;
  text: string;
  /** 该条目是否为 bot 自身的回复(渲染时可视觉区分)。 */
  isBot?: boolean;
}

/**
 * 任务来源元数据 —— 告知 desktop 这条任务来自哪个 IM 平台及其上下文。
 * 字段全部可选(im 除外); 旧 server 不发时 desktop 降级为纯文本渲染。
 */
export interface TaskSource {
  /** IM 平台标识(开放集合): 'slack' | 'feishu' | 'discord' | ... */
  im: string;
  /** 来源显示名(频道名 "#general"、群名等); null = 未知。 */
  channelName?: string | null;
  /**
   * (multi-team)来源 Slack workspace id / 显示名: desktop 存进 session
   * meta, 作会话标题前缀与网关工具调用的默认 team。老 server 不下发。
   */
  teamId?: string | null;
  teamName?: string | null;
  /** 结构化 thread 上下文; 省略或空数组 = 无 thread 历史。 */
  threadContext?: ThreadContextEntry[];
  /**
   * 用户 @ bot 的干净原文(UI 显示用) —— 不含 thread 上下文与 prompt 指引。
   * desktop 据此渲染任务卡片正文, 与发给 agent 的完整 prompt 彻底分离。
   */
  userText?: string;
}

/**
 * task.dispatch(server -> desktop): 派发一个任务。
 * 两种会话定位方式:
 *   - sessionId 为 null(默认): 按 externalKey 查映射, 有则复用、无则在
 *     workspace 别名对应目录下新建 —— 此时 workspace 必填。
 *   - sessionId 非 null(接管): 直接投进该已有 desktop session 并把
 *     externalKey 重绑到它; workspace 忽略(session 自带工作目录, 但其
 *     workingDir 必须落在本连接注册的别名路径内, 否则 rejected)。
 */
export interface TaskDispatchPayload {
  requestId: string;
  externalKey: string;
  /** 工作区别名; sessionId 为 null 时必填(非 null 字符串)。 */
  workspace: string | null;
  /** 接管目标 session; 普通流程恒 null。 */
  sessionId: string | null;
  prompt: string;
  options?: TaskDispatchOptions;
  /** 入站附件(可选); 省略或空数组 = 无附件, 纯文本任务。 */
  attachments?: TaskAttachment[];
  /** 任务来源元数据; 省略 = 来源未知, desktop 按纯文本处理。 */
  source?: TaskSource;
}

/** ack 三态。 */
export const TASK_ACK_RESULTS = ['accepted', 'queued', 'rejected'] as const;
export type TaskAckResult = (typeof TASK_ACK_RESULTS)[number];

/** rejected 的机器可读原因。 */
export const TASK_REJECT_REASONS = [
  /** workspace 别名未在本连接注册。 */
  'unknown_workspace',
  /** 接管目标 session 的工作目录不在本连接注册的别名路径内。 */
  'workspace_not_allowed',
  /** 接管目标 session 不存在。 */
  'session_not_found',
  /** desktop 侧 hook 功能已关闭(总开关或本连接开关)。 */
  'disabled',
  /** 参数非法(desktop 业务层校验不过, 区别于协议层直接拒收的坏帧)。 */
  'invalid',
] as const;
export type TaskRejectReason = (typeof TASK_REJECT_REASONS)[number];

/**
 * task.ack(desktop -> server): dispatch 的立即应答。
 * 字段联动约束(parse 强制):
 *   - reason 仅 rejected 时非 null;
 *   - queuePosition 仅 queued 时非 null(0 起, 非负整数);
 *   - sessionId 在 accepted / queued 时为目标 session id, rejected 时为 null。
 */
export interface TaskAckPayload {
  requestId: string;
  result: TaskAckResult;
  reason: TaskRejectReason | null;
  sessionId: string | null;
  queuePosition: number | null;
}

// ── 阶段 4: 交差 ─────────────────────────────────────────────────────────────

/** cancelled: task.cancel 中断收口(errorMessage 恒 null, finalText 可为已产出的部分文本)。 */
export const TURN_END_STATUSES = ['ok', 'error', 'cancelled'] as const;
export type TurnEndStatus = (typeof TURN_END_STATUSES)[number];

/** turn 的用量摘要。v1 只有耗时, 字段可空(拿不到就 null, 不编造)。 */
export interface TurnEndUsage {
  durationMs: number | null;
}

/**
 * turn.end(desktop -> server): 任务收口。
 * 收口时机以 maker-core 事件流的 done / terminal error 为准。
 * 字段联动约束(parse 强制): status 为 'ok' 时 errorMessage 必须为 null;
 * 为 'error' 时 errorMessage 必须为非空字符串。
 */
export interface TurnEndPayload {
  requestId: string;
  externalKey: string;
  sessionId: string | null;
  status: TurnEndStatus;
  /** 该 turn 的最终文本(error 时可为空串)。 */
  finalText: string;
  errorMessage: string | null;
  usage: TurnEndUsage;
  /**
   * 出站附件(agent 产出的图片 / 文件, base64 内联) —— 与入站 attachments
   * 对称复用 TaskAttachment。desktop 侧从最终文本的 xdt-image / xdt-file
   * 引用与 tool_result 旁路收集并施加大小/数量限额(finalText 中对应引用
   * 已剥离/替换为提示); server 侧上传到渠道。省略或空数组 = 无附件。
   * 旧 server 收到未知字段静默忽略(校验器只查已知字段), 向后兼容。
   */
  attachments?: TaskAttachment[];
}

// ── 阶段 9(v2): 执行进度 ────────────────────────────────────────────────────

/**
 * turn.progress(desktop -> server): turn 执行中的渲染快照(见文件头第 9 条)。
 * text 是 desktop 合成好的完整 markdown 快照(过程区时间线 + 已产出的部分
 * 正文), server 侧不拼接、不累积 —— 每帧整体替换占位消息内容(latest-wins,
 * 丢帧无害)。desktop 侧负责节流(约 1.5s/帧)与长度控制。
 */
export interface TurnProgressPayload {
  requestId: string;
  /** 当前渲染快照(完整替换语义, 非增量)。 */
  text: string;
}

// ── 阶段 5(v2): 身份绑定 ────────────────────────────────────────────────────

/**
 * bind.start(desktop -> server): 发起「Slack 用户 ↔ 本设备」绑定。
 * 阶段 4 起绑定走 Sign in with Slack(OIDC): 新桌面端发**空对象** `{}`,
 * server 据连接身份签发授权链接经 bind.update(pending, authorizeUrl)回推。
 * 设备身份取连接 hello 的 deviceId, 不在本帧携带。
 *
 * email 字段仅为识别老客户端保留(@deprecated): 老桌面端仍按邮箱发起,
 * server 收到带 email 的 bind.start 即判定为旧版, 回 bind.update(failed)
 * 提示升级, 不再执行邮箱定位。
 */
export interface BindStartPayload {
  /** @deprecated 旧版邮箱绑定流字段; 新端不再发送, 仅用于 server 识别老客户端。 */
  email?: string;
  /**
   * (multi-team)重新授权指定 workspace 时 pin 授权页到该 team(server 在
   * 授权链接上带 team 参数); 缺省/null = 用户在授权页自选(添加新 team)。
   * 老 server 校验器不查本字段, 安全透传(它照常签发不 pin 的链接)。
   */
  teamId?: string | null;
}

/**
 * bind.update 状态机:
 *   none      未绑定(连接建立后 server 主动推一帧告知现状)
 *   pending   OIDC 授权链接已签发(authorizeUrl 非空), 等待用户在浏览器授权
 *   confirmed 绑定成立(slackUserId / slackUserName 非空)
 *   denied    用户在 Slack 授权页点了拒绝
 *   expired   授权超时(state 令牌过期)
 *   failed    流程失败(如老客户端、该 workspace 未安装本 app), message 携带原因
 *   revoked   绑定被解除(本设备主动 revoke, 或被同用户新设备顶掉)
 */
export const BIND_UPDATE_STATES = [
  'none',
  'pending',
  'confirmed',
  'denied',
  'expired',
  'failed',
  'revoked',
] as const;
export type BindUpdateState = (typeof BIND_UPDATE_STATES)[number];

/**
 * bind.update(server -> desktop): 绑定状态推送(bind.start 的应答 + 后续
 * 任何状态变化, 含连接建立时的现状同步与被新设备顶掉的通知)。
 * 字段联动(parse 强制): confirmed 时 slackUserId 非空; pending 时
 * authorizeUrl 非空(OIDC 授权链接); failed 时 message 非空。
 */
export interface BindUpdatePayload {
  state: BindUpdateState;
  slackUserId: string | null;
  /** Slack 显示名(设置页展示「已绑定 @xxx」用), 拿不到可为 null。 */
  slackUserName: string | null;
  /** 人类可读补充说明(failed 原因 / revoked 缘由等)。 */
  message: string | null;
  /**
   * OIDC 授权链接(仅 state=pending 时非空): 桌面端用系统浏览器打开它,
   * 用户在 Slack 授权页确认后 server 回调完成绑定。其它状态省略或 null。
   */
  authorizeUrl?: string | null;
  /**
   * 结构化失败原因(仅 state=failed 时可选)。桌面端按它分支 UI, 不解析
   * message 文案(规则 9)。当前已定义:
   *   'not-installed' —— 用户授权的 Slack workspace 未安装本 App(SIWS 授权
   *   不要求安装, 但 bot 无 token 收发消息), 桌面端显示「安装 App」引导。
   * parse 侧只校验 string|null(未知值放行), 老客户端遇到新 reason 忽略即可。
   */
  reason?: string | null;
  /**
   * 按 workspace 定制的安装链接(仅 reason='not-installed' 时可选): 携带
   * team 参数, Slack 安装授权页会预选到用户刚授权的那个 workspace, 免手选。
   * 桌面端缺省(老 server)回退通用 /slack/install 链接。
   */
  installUrl?: string | null;
  /**
   * 绑定所在 Slack workspace 显示名(仅 state=confirmed 时可选下发, 取安装
   * 档案的 teamName): 设置页状态行展示「已绑定 @xxx(workspace)」。老 server
   * 不下发或档案缺名时为 null/缺省, 桌面端回退只显示用户名。
   */
  teamName?: string | null;
  /**
   * (multi-team)事件所属 Slack workspace id: confirmed / revoked 按 team
   * 定位到绑定列表的对应行; 授权流早期(pending / denied / expired)团队
   * 尚未确定, 为 null/缺省。老 server 不下发, 单绑定桌面端不依赖本字段。
   */
  teamId?: string | null;
}

/** bind.update.reason 已知值: 绑定的 Slack workspace 未安装本 App。 */
export const BIND_FAIL_REASON_NOT_INSTALLED = 'not-installed';

/** bind.update.reason 已知值(multi-team): 该绑定被同用户在另一台设备顶替。 */
export const BIND_FAIL_REASON_SUPERSEDED = 'superseded';

/**
 * bind.revoke(desktop -> server): 解除本设备绑定。
 * teamId 非空 = 只解绑该 workspace(multi-team); 空/缺省 = 解绑本设备全部
 * (兼容单绑定老 desktop 的"关开关即全解")。pendingOnly=true = 只作废
 * 进行中的授权尝试(pending 授权 / 等安装登记), 不触碰任何已确认绑定 ——
 * multi-team 下「取消添加 workspace」的通道(此时 teamId 忽略)。
 * ⚠ 旧 server 对带字段的帧 parse 拒收(它要求空对象), desktop 仅在
 * welcome.features 声明 multi-team 后才发非空形态。
 */
export interface BindRevokePayload {
  teamId?: string | null;
  pendingOnly?: boolean;
}

/**
 * bind.state(server -> desktop, multi-team): 本设备绑定全量快照。
 * 权威列表语义 —— 连接建立与任何绑定变化(新增 / 解除 / 被顶 / 撤权清理)
 * 后整体推送, desktop 以此对齐本地列表(bind.update 只承载过程事件)。
 * 仅对 hello.features 声明 multi-team 的连接下发; 旧 desktop 不认识本
 * 类型, parse 拒收丢帧不断连。
 */
export interface BindStateEntry {
  teamId: string;
  /** workspace 显示名(安装档案 teamName); 档案缺名时 null。 */
  teamName: string | null;
  slackUserId: string;
  slackUserName: string | null;
}

export interface BindStatePayload {
  bindings: BindStateEntry[];
}

// ── Provider-neutral binding (append-only v1) ───────────────────────────────

/** IM providers supported by the shared Cindy relay. */
export const HOOK_PROVIDERS = ['slack', 'telegram'] as const;
export type HookProvider = (typeof HOOK_PROVIDERS)[number];

/**
 * Provider binding states. A binding attempt moves monotonically from pending
 * through optional confirmation to confirmed, or one of the terminal states.
 */
export const PROVIDER_BIND_STATES = [
  'none',
  'pending',
  'awaiting_confirmation',
  'confirmed',
  'denied',
  'expired',
  'failed',
  'revoked',
  'superseded',
] as const;
export type ProviderBindState = (typeof PROVIDER_BIND_STATES)[number];

/** Known UI action hints. The wire remains open; consumers ignore unknown values. */
export const PROVIDER_BIND_ACTIONS = [
  'open_connect_url',
  'copy_connect_url',
  'cancel',
  'retry',
  'revoke',
  'open_provider',
  'add_to_group',
] as const;
export type KnownProviderBindAction = (typeof PROVIDER_BIND_ACTIONS)[number];
export type ProviderBindAction = string;

/** Start a provider-specific, one-time binding attempt for this device. */
export interface ProviderBindStartPayload {
  requestId: string;
  provider: HookProvider;
  /** Optional provider scope (for example a Slack team or Telegram bot id). */
  scopeId?: string | null;
}

/** Cancel exactly one in-flight binding attempt without touching a binding. */
export interface ProviderBindCancelPayload {
  requestId: string;
  provider: HookProvider;
  attemptId: string;
}

/** Revoke exactly one confirmed binding. */
export interface ProviderBindRevokePayload {
  requestId: string;
  provider: HookProvider;
  bindingId: string;
}

/**
 * Shared payload for provider.bind.update and provider.bind.state. update is an
 * event/reply; state is an authoritative point-in-time snapshot for one scope.
 * All nullable fields are explicit so an old value cannot survive a snapshot.
 */
export interface ProviderBindStatusPayload {
  provider: HookProvider;
  /** Request id being answered, or null for an unsolicited state push. */
  replyTo: string | null;
  state: ProviderBindState;
  attemptId: string | null;
  bindingId: string | null;
  principalId: string | null;
  principalName: string | null;
  scopeId: string | null;
  scopeName: string | null;
  /** One-time provider deep link; present only while state=pending. */
  connectUrl: string | null;
  /** Unix milliseconds; required for pending/awaiting_confirmation attempts. */
  expiresAt: number | null;
  /** Stable machine-readable reason; required for unsuccessful terminal states. */
  reason: string | null;
  /** Optional safe recovery/provider URL interpreted by the host application. */
  remediationUrl: string | null;
  actions: ProviderBindAction[];
}

export type ProviderBindUpdatePayload = ProviderBindStatusPayload;
export type ProviderBindStatePayload = ProviderBindStatusPayload;

// ── 阶段 6(v2): 实时问答 ────────────────────────────────────────────────────

/** 可查询的清单种类。 */
export const QUERY_KINDS = ['workspaces', 'models', 'sessions'] as const;
export type QueryKind = (typeof QUERY_KINDS)[number];

/**
 * query.request(server -> desktop): 实时拉取清单(/bind /model /effort 触发)。
 * queryId 由 server 生成, response 原样回传配对; server 侧自行做超时。
 */
export interface QueryRequestPayload {
  queryId: string;
  kind: QueryKind;
}

/**
 * 模型条目: efforts 为该模型支持的思考强度档位(可空数组 = 不支持调档)。
 * group 是目录分组 id(如 'gpt' / 'gpt-budget'): 骨折版与官方版 displayName
 * 故意同名、仅靠分组区分, server 渲染下拉时据此加区分后缀, 否则出现两个
 * 一模一样的 "GPT-5.5"(线上实撞)。可选 —— 旧桌面端不发, server 视为无分组。
 */
export interface QueryModelEntry {
  id: string;
  label: string;
  efforts: string[];
  defaultEffort: string | null;
  group?: string | null;
}

/**
 * 权限档条目(label = desktop capabilities 的 displayName, 原样透传,
 * 与模型 label 同风格 —— server 不做本地化映射, 避免档位集合演进时文案漂移)。
 */
export interface QueryPermissionModeEntry {
  id: string;
  label: string;
}

/**
 * 按 agent 分组的模型清单(kind=models 的响应体)。
 * permissionModes 缺席 = 旧版 desktop(不支持权限档下发), server 侧应隐藏
 * 权限选择 UI; 空数组 = 该 agent 无可选档位, 同样隐藏。
 */
export interface QueryAgentModels {
  agentKind: string;
  models: QueryModelEntry[];
  permissionModes?: QueryPermissionModeEntry[];
}

/** Privacy-minimised recent-session entry for the provider session picker. */
export interface QuerySessionEntry {
  id: string;
  title: string;
  /** Workspace alias only; local absolute paths are forbidden on this wire. */
  workspace: string;
  /** Unix milliseconds of the latest local activity. */
  lastActiveAt: number;
}

/**
 * query.response(desktop -> server): 问答应答。
 * ok=false 时 error 非空(desktop 侧取清单失败); ok=true 时按 kind 携带
 * workspaces 或 agents 之一(parse 强制)。
 */
export interface QueryResponsePayload {
  queryId: string;
  kind: QueryKind;
  ok: boolean;
  error: string | null;
  /** kind=workspaces 且 ok 时必填: 当前注册的工作区别名。 */
  workspaces?: string[];
  /** kind=models 且 ok 时必填: 按 agent 分组的可用模型与 effort 档位。 */
  agents?: QueryAgentModels[];
  /** kind=sessions 且 ok 时必填: at most 20 privacy-minimised entries. */
  sessions?: QuerySessionEntry[];
}

// ── 阶段 7(v2): 任务取消 ────────────────────────────────────────────────────

/**
 * task.cancel(server -> desktop): 中断在跑任务(/stop 触发)。
 * desktop 收到后中断对应 session 的当前 turn, 以 turn.end(cancelled) 收口;
 * requestId 未知 / 任务已收口时静默忽略(与 turn.end 的竞态由 server 侧
 * 幂等消化)。
 */
export interface TaskCancelPayload {
  requestId: string;
}

// ── 阶段 8(v2): 会话归档 ────────────────────────────────────────────────────

/**
 * session.archive(server -> desktop): 归档 externalKey 绑定的会话(私聊
 * /new 换代触发, 旧代会话不再显示在桌面端列表)。desktop 侧幂等: 无绑定、
 * 会话不存在或已归档时静默忽略。老版本 desktop 不认识本类型, parse 拒收
 * 丢帧不断连(见文件头「type 为开放集合」约定), 仅表现为旧会话留在列表。
 */
export interface SessionArchivePayload {
  externalKey: string;
}

// ── 阶段 10(v2): 执行中交互 ─────────────────────────────────────────────────

/** 单个交互卡按钮上限(Slack actions block 每块 5 个 x 分块, 取宽松上限)。 */
export const MAX_INTERACTION_BUTTONS = 24;

/**
 * 交互卡按钮。id 是 desktop 侧的决策映射键(server 原样回传, 不理解语义),
 * 同一张卡内唯一; 字符集限制: 不含 '|'(server 侧 value 复合编码分隔符)。
 */
export interface InteractionButton {
  id: string;
  label: string;
  /** 视觉样式(Slack 按钮 style; default = 无样式)。 */
  style: 'primary' | 'danger' | 'default';
}

/**
 * interaction.request(desktop -> server): turn 执行中 agent 发起的用户交互,
 * 以「标题 + markdown 正文 + 按钮组」的渠道无关卡片形式转发。server 渲染进
 * 该任务的回帖 thread, 按钮按压回 interaction.decision。
 * kind 是开放集合(当前 'ask_user_question' / 'plan_review'), server 只透传
 * 日志不理解语义 —— 新 kind 不需要 server 升级。
 */
export interface InteractionRequestPayload {
  /** 所属任务(server 据此定位回帖 thread 并校验归属)。 */
  requestId: string;
  /** 交互唯一标识(maker-core InteractionRequest.requestId), 决策配对键。 */
  interactionId: string;
  kind: string;
  title: string;
  /** markdown 正文(server 转渠道格式渲染); 可为空串。 */
  body: string;
  buttons: InteractionButton[];
}

/**
 * interaction.decision(server -> desktop): 用户按下交互卡按钮。
 * desktop 按 interactionId 配对挂起的交互, 用 buttonId 查自己登记的
 * 按钮->决策映射(语义不过网线)。迟到/未知的 decision 静默忽略。
 */
export interface InteractionDecisionPayload {
  requestId: string;
  interactionId: string;
  buttonId: string;
}

/**
 * interaction.cancel(desktop -> server): 交互已在 desktop 侧收口(超时按
 * 安全默认自决 / turn 结束), 通知 server 改写卡片(摘按钮 + reason 文案),
 * 防止用户对着死卡片按。幂等: server 找不到对应卡片时静默忽略。
 */
export interface InteractionCancelPayload {
  requestId: string;
  interactionId: string;
  /** 卡片改写文案(人类可读)。 */
  reason: string;
}

// ── 阶段 11(v2): 目录偏好远程读写 ──────────────────────────────────────────

/** prefs.get(desktop -> server): 拉取本设备绑定用户的全部目录偏好快照。 */
export interface PrefsGetPayload {
  /** desktop 生成的关联 id, prefs.state.replyTo 回显配对。 */
  requestId: string;
}

/** 单目录偏好条目(与 server user_prefs 行同形; slackUserId 不过网线)。 */
export interface WorkspacePrefsEntry {
  workspace: string;
  model: string | null;
  effort: string | null;
  agentKind: string | null;
  permissionMode: string | null;
  /**
   * (multi-team)偏好归属的 Slack workspace。多绑定设备的快照覆盖全部已绑
   * team, 桌面端按 teamId 分组编辑。老 server 不下发(单绑定语境无歧义)。
   */
  teamId?: string | null;
}

/**
 * prefs.set(desktop -> server): 部分更新某目录偏好(undefined 字段不动,
 * null 显式清空 —— 与 server setPrefs / dispatch options 同语义)。
 * server 只做 shape 校验, 不校验值合法性(值来自 desktop 自己的能力清单;
 * 过期值由 desktop 派发侧 defaults 兜底)。
 */
export interface PrefsSetPayload {
  requestId: string;
  workspace: string;
  model?: string | null;
  effort?: string | null;
  agentKind?: string | null;
  permissionMode?: string | null;
  /**
   * (multi-team)写入目标 team。缺省/null = 设备唯一绑定(多绑定时 server
   * 不猜测, 忽略写入并在应答快照中原样回放现状)。老 server 不查本字段。
   */
  teamId?: string | null;
}

/**
 * prefs.state(server -> desktop): 绑定用户的全量目录偏好快照。
 * replyTo 回显 get/set 的 requestId; 主动推送(/model 卡写入后)为 null。
 * 字段联动(parse 强制): bound=false 时 prefs 恒空数组(未绑定无偏好可言)。
 */
export interface PrefsStatePayload {
  replyTo: string | null;
  bound: boolean;
  prefs: WorkspacePrefsEntry[];
}

// ── Provider-neutral preferences (append-only v1) ──────────────────────────

/** Provider preference selector; exactly one of bindingId/scopeId is non-null. */
export interface ProviderPrefsSelector {
  provider: HookProvider;
  bindingId: string | null;
  scopeId: string | null;
}

export interface ProviderPrefsGetPayload extends ProviderPrefsSelector {
  requestId: string;
}

export interface ProviderPrefsSetPayload extends ProviderPrefsSelector {
  requestId: string;
  workspace: string;
  model?: string | null;
  effort?: string | null;
  agentKind?: string | null;
  permissionMode?: string | null;
}

/** Provider-neutral preference row (intentionally has no Slack teamId field). */
export interface ProviderWorkspacePrefsEntry {
  workspace: string;
  model: string | null;
  effort: string | null;
  agentKind: string | null;
  permissionMode: string | null;
}

export interface ProviderPrefsStatePayload extends ProviderPrefsSelector {
  replyTo: string | null;
  bound: boolean;
  prefs: ProviderWorkspacePrefsEntry[];
}

// ── 阶段 12(v2): Slack 网关工具 ────────────────────────────────────────────

/**
 * welcome.features 能力标识: server 支持 tool.request / tool.response 帧族
 * (Slack 网关工具)。desktop 侧发 tool.request 前先查本标识, 缺席直接短路
 * 为 SERVER_TOO_OLD, 不打空炮。
 */
export const HOOK_FEATURE_SLACK_TOOLS = 'slack-tools';

/**
 * 双向能力标识: 多 workspace 绑定(见文件头第 13 条)。desktop 在
 * hello.features 声明会消费 bind.state / 按 team 定位的帧; server 在
 * welcome.features 声明支持。任一侧缺席回落单绑定行为。
 */
export const HOOK_FEATURE_MULTI_TEAM = 'multi-team';

/** Both peers must advertise this before using provider.bind.* frames. */
export const HOOK_FEATURE_PROVIDER_BIND = 'provider-bind-v1';

/** Both peers must advertise this before using provider.prefs.* frames. */
export const HOOK_FEATURE_PROVIDER_PREFS = 'provider-prefs-v1';

/** Both peers must advertise this before query.kind=sessions is used. */
export const HOOK_FEATURE_SESSION_PICKER = 'session-picker-v1';

/** Server capability announcing that its provider registry enables Telegram. */
export const HOOK_FEATURE_PROVIDER_TELEGRAM = 'provider:telegram';

/**
 * 内置「对话」伪工作目录的保留别名。desktop 恒把它放进 hello / query 的
 * workspaces 清单首位(绑定到它的任务以无项目目录的对话模式运行), 真实
 * 目录别名不许撞名(desktop 侧校验)。server 据此识别伪目录: 清单里只剩
 * 本别名(用户没配任何真实目录)时不走「单目录自动绑」捷径, 仍发选择卡
 * 让用户显式确认, 并提示去桌面端配置真实目录。
 */
export const HOOK_CHAT_WORKSPACE_ALIAS = 'chat';

/**
 * tool.request(desktop -> server): 调用 server 侧 Slack 网关工具。
 * tool 为开放集合(当前约定 'status' / 'listTools' / 'callTool'), server
 * 不认识的值回 UNKNOWN_TOOL 错误而非丢帧 —— 网关工具演进不需要协议升级。
 */
export interface ToolRequestPayload {
  /** desktop 生成的关联 id; tool.response.replyTo 回显配对。 */
  requestId: string;
  /** 网关工具名(开放集合)。 */
  tool: string;
  /** 工具参数(如 callTool 的 { name, arguments }); 省略 = 无参。 */
  args?: Record<string, unknown>;
  /**
   * (multi-team)以哪个 workspace 的绑定身份执行。缺省/null = 设备唯一
   * 绑定; 多绑定设备缺省时 server 拒绝猜测, 回结构化错误 AMBIGUOUS_TEAM
   * —— 以错误身份向错误 workspace 发消息是本帧族最重的串台风险(规则 9)。
   */
  teamId?: string | null;
}

/**
 * 网关工具的结构化错误。code 是机器可读错误码(如 NOT_BOUND / NO_USER_TOKEN /
 * UNKNOWN_TOOL / TOKEN_EXPIRED / RATE_LIMITED), desktop 按 code 分支提示,
 * message 仅人类可读补充 —— 两端都不得解析 message 做逻辑(规则 9)。
 */
export interface ToolErrorShape {
  code: string;
  message: string;
}

/**
 * tool.response(server -> desktop): tool.request 的应答。
 * 字段联动(parse 强制): ok=false 时 error 必须为非空 {code, message};
 * ok=true 时 error 必须缺席或 null(result 形状由具体工具约定, 协议不限)。
 */
export interface ToolResponsePayload {
  /** 回显 tool.request.requestId。 */
  replyTo: string;
  ok: boolean;
  /** ok=true 时的结果(任意 JSON; listTools/callTool 透传 MCP 结果语义)。 */
  result?: unknown;
  /** ok=false 时的结构化错误。 */
  error?: ToolErrorShape | null;
}

// ── 消息联合 ─────────────────────────────────────────────────────────────────

export type HookHelloMessage = HookEnvelope<'hello', HelloPayload>;
export type HookWelcomeMessage = HookEnvelope<'welcome', WelcomePayload>;
export type HookPingMessage = HookEnvelope<'ping', PingPayload>;
export type HookPongMessage = HookEnvelope<'pong', PongPayload>;
export type HookTaskDispatchMessage = HookEnvelope<'task.dispatch', TaskDispatchPayload>;
export type HookTaskAckMessage = HookEnvelope<'task.ack', TaskAckPayload>;
export type HookTurnEndMessage = HookEnvelope<'turn.end', TurnEndPayload>;
export type HookTurnProgressMessage = HookEnvelope<'turn.progress', TurnProgressPayload>;
export type HookBindStartMessage = HookEnvelope<'bind.start', BindStartPayload>;
export type HookBindUpdateMessage = HookEnvelope<'bind.update', BindUpdatePayload>;
export type HookBindRevokeMessage = HookEnvelope<'bind.revoke', BindRevokePayload>;
export type HookQueryRequestMessage = HookEnvelope<'query.request', QueryRequestPayload>;
export type HookQueryResponseMessage = HookEnvelope<'query.response', QueryResponsePayload>;
export type HookTaskCancelMessage = HookEnvelope<'task.cancel', TaskCancelPayload>;
export type HookSessionArchiveMessage = HookEnvelope<'session.archive', SessionArchivePayload>;
export type HookInteractionRequestMessage = HookEnvelope<
  'interaction.request',
  InteractionRequestPayload
>;
export type HookInteractionDecisionMessage = HookEnvelope<
  'interaction.decision',
  InteractionDecisionPayload
>;
export type HookInteractionCancelMessage = HookEnvelope<
  'interaction.cancel',
  InteractionCancelPayload
>;
export type HookPrefsGetMessage = HookEnvelope<'prefs.get', PrefsGetPayload>;
export type HookPrefsSetMessage = HookEnvelope<'prefs.set', PrefsSetPayload>;
export type HookPrefsStateMessage = HookEnvelope<'prefs.state', PrefsStatePayload>;
export type HookToolRequestMessage = HookEnvelope<'tool.request', ToolRequestPayload>;
export type HookToolResponseMessage = HookEnvelope<'tool.response', ToolResponsePayload>;
export type HookBindStateMessage = HookEnvelope<'bind.state', BindStatePayload>;
export type HookProviderBindStartMessage = HookEnvelope<
  'provider.bind.start',
  ProviderBindStartPayload
>;
export type HookProviderBindCancelMessage = HookEnvelope<
  'provider.bind.cancel',
  ProviderBindCancelPayload
>;
export type HookProviderBindRevokeMessage = HookEnvelope<
  'provider.bind.revoke',
  ProviderBindRevokePayload
>;
export type HookProviderBindUpdateMessage = HookEnvelope<
  'provider.bind.update',
  ProviderBindUpdatePayload
>;
export type HookProviderBindStateMessage = HookEnvelope<
  'provider.bind.state',
  ProviderBindStatePayload
>;
export type HookProviderPrefsGetMessage = HookEnvelope<
  'provider.prefs.get',
  ProviderPrefsGetPayload
>;
export type HookProviderPrefsSetMessage = HookEnvelope<
  'provider.prefs.set',
  ProviderPrefsSetPayload
>;
export type HookProviderPrefsStateMessage = HookEnvelope<
  'provider.prefs.state',
  ProviderPrefsStatePayload
>;

/** 全部合法消息的判别联合(按 `type` 判别)。 */
export type HookMessage =
  | HookHelloMessage
  | HookWelcomeMessage
  | HookPingMessage
  | HookPongMessage
  | HookTaskDispatchMessage
  | HookTaskAckMessage
  | HookTurnEndMessage
  | HookTurnProgressMessage
  | HookBindStartMessage
  | HookBindUpdateMessage
  | HookBindRevokeMessage
  | HookQueryRequestMessage
  | HookQueryResponseMessage
  | HookTaskCancelMessage
  | HookSessionArchiveMessage
  | HookInteractionRequestMessage
  | HookInteractionDecisionMessage
  | HookInteractionCancelMessage
  | HookPrefsGetMessage
  | HookPrefsSetMessage
  | HookPrefsStateMessage
  | HookToolRequestMessage
  | HookToolResponseMessage
  | HookBindStateMessage
  | HookProviderBindStartMessage
  | HookProviderBindCancelMessage
  | HookProviderBindRevokeMessage
  | HookProviderBindUpdateMessage
  | HookProviderBindStateMessage
  | HookProviderPrefsGetMessage
  | HookProviderPrefsSetMessage
  | HookProviderPrefsStateMessage;

/** parseHookMessage 的结果 —— 不抛异常, 坏帧以 error 字符串描述具体原因。 */
export type HookParseResult = { ok: true; message: HookMessage } | { ok: false; error: string };
