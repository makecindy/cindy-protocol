# Skill Protocol

`@cindy/skill-protocol` 是 plugin-server Skill Domain 与 Desktop Skill 市场共享的零运行时依赖 TypeScript contract。它定义发布包 manifest，以及普通客户端使用的市场列表、详情和下载响应；不包含服务端数据库、管理 API 或本地安装实现。

## 使用方式

消费方通过 `cindy-protocol` submodule 和 pnpm workspace 引用：

```json
{
  "dependencies": {
    "@cindy/skill-protocol": "workspace:*"
  }
}
```

```ts
import {
  SkillProtocolError,
  parseGetSkillResponse,
  parseListSkillsResponse,
  parseSkillDownloadResponse,
  parseSkillPackageManifest,
} from '@cindy/skill-protocol';
```

所有外部输入必须先按 `unknown` 处理，再交给解析器。解析失败会抛出带字段路径的 `SkillProtocolError`；调用方不得继续发布、安装或切换 Version。

## Skill 发布 manifest

发布请求携带 `SkillPackageManifest`，它不是包内文件，也不进入自己的 `files` 清单：

```json
{
  "schemaVersion": 1,
  "slug": "release-helper",
  "name": "Release Helper",
  "description": "Prepare and validate a release.",
  "version": "1.0.0",
  "files": [
    {
      "path": "SKILL.md",
      "sizeBytes": 128,
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  ]
}
```

约束：

- `slug` 为 1–64 位小写字母、数字或连字符，并以字母或数字开头和结尾，且不能使用 Windows 设备保留名；
- `SKILL.md` 必须位于包根且非空；
- `files` 只列普通文件，必须按 `path` 逐字升序排列；
- 路径使用 NFC 规范化的相对 POSIX 格式，并同时满足 macOS、Windows 和 Linux 的安全文件名约束；
- 大小与 SHA-256 针对每个文件的原始字节；
- 大小上限、文件数量、压缩率、symlink、可执行文件和危险类型属于服务端发布策略，不固化进 wire protocol；
- 服务端必须从上传制品重新计算清单，并校验 `SKILL.md` frontmatter 的 `name`、`description` 与 manifest 一致，不能信任发布方声明。

未知字段会被忽略且不会出现在规范化返回值中。不支持的 `schemaVersion` 必须拒绝。

## 市场交付契约

Skill 市场使用：

- `parseListSkillsResponse`：分页摘要；
- `parseGetSkillResponse`：单项详情和完整发布 manifest；
- `parseSkillDownloadResponse`：当前 Version 的短期 HTTPS 下载凭证。

```text
GET /api/skills
GET /api/skills/:skillId
GET /api/skills/:skillId/versions/:versionId/download
```

字段语义：

| 字段             | 语义                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `Skill.id`       | plugin-server 生成的永久资源 ID，是本地市场安装记录的远程身份。                               |
| `slug`           | 同一 Scope owner 内唯一的逻辑名称；不同 owner 间允许重名。                                    |
| `scope`          | `public` 对所有登录身份可见；`organization` 只对对应组织可见；`personal` 只对当前自然人可见。 |
| `organizationId` | Organization 必须为 1–128 字符的组织 ID；Public 和 Personal 恒为 `null`。                     |
| `currentVersion` | 普通客户端可安装的当前唯一 Version；列表只含摘要，详情额外包含 manifest。                     |
| `nextCursor`     | 下一页使用的 `Skill.id`，没有下一页时为 `null`。                                              |

普通客户端 DTO 刻意不暴露 `ownerPassportId`。Personal 资源已经由服务端按已验签的 `passportId` 过滤，客户端不需要也不能据此自行授权。

详情解析器会额外校验：

- 外层 `slug/name/description` 与 manifest 一致；
- `currentVersion.version` 与 manifest `version` 一致；
- Scope 与 `organizationId` 一致。

下载响应只接受 HTTPS、64 位小写十六进制 SHA-256、正整数字节数和带毫秒的 UTC ISO 8601 过期时间。下载后仍须重新计算完整制品 SHA-256，再进入 staging 解包和逐文件清单校验。

## 版本与兼容行为

- `SKILL_PACKAGE_SCHEMA_VERSION=1`；
- `SKILL_API_SCHEMA_VERSION=1`；
- 两个版本独立演进。

新增可选字段可以 append-only 扩展；解析器忽略未知字段。删除字段、改变字段语义或新增必填字段必须提升对应 schema version。

当客户端遇到不支持的 envelope 或 manifest 版本时：

- 首次安装失败并提示当前 Cindy 版本不兼容；
- 更新失败时丢弃 staging，保留现有本地 Skill 和安装记录；
- 不执行原子替换，不更新 Version ID 或 SHA-256。

## 边界

本包不定义：

- Public/Organization/Personal 管理 API；
- Platform admin、Organization owner/admin 或 Personal owner 的写权限；
- GitHub OIDC、人工上传会话和发布溯源；
- 分类、搜索排序、下载量和审核状态；
- global/project 本地安装位置；
- XD SkillHub 的旧可见性和部门模型。

这些能力由 plugin-server 和 Desktop 各自实现；出现真实跨仓 wire consumer 后再以版本化字段扩展，不能提前塞入无消费者的万能 DTO。
