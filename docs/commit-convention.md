# Commit 规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/):`<type>(<scope>): <subject>`。

- **type**:`feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `ci` / `revert`
- **scope**:`slack-hook` / `device-link` / `plugin` / `voice` / `docs` / `repo`
- **subject**:祈使句、结尾不加句号;type/scope 用英文,subject 中英文皆可
- **破坏性变更**:type 后加 `!`(如 `feat(device-link)!: ...`),正文写 `BREAKING CHANGE:` 说明,且**同一提交内必须 bump 对应协议的版本号**(见 [CONTRIBUTING.md](../CONTRIBUTING.md) 「协议演进纪律」第 5 条)

仓库根提供了提交模板,clone 后执行一次即可在 `git commit` 时自动带出格式提示:

```bash
git config commit.template .gitmessage
```
