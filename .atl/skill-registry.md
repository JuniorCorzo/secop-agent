# Skill Registry — secop-agent

> Auto-generated index of available skills. Source of truth: each `SKILL.md`.
> Pass exact paths to subagents. Regenerate after installing/removing skills.

## Registry Contract

- Index only — `SKILL.md` is authoritative.
- Skip: `sdd-*`, `_shared`, `skill-registry`, pi-subagents, pi-intercom.
- Prefer project-level skill over user-level duplicate.

## Index

| Skill | Trigger / Description | Scope | Path |
|-------|----------------------|-------|------|
| secop-conventions | Writing, reviewing, refactoring code. SOLID, YAGNI, KISS. | project | `.pi/skills/secop-conventions/SKILL.md` |
| openspec-apply-change | Implement tasks from OpenSpec change | project | `.pi/skills/openspec-apply-change/SKILL.md` |
| openspec-archive-change | Archive completed change | project | `.pi/skills/openspec-archive-change/SKILL.md` |
| openspec-explore | Explore mode — thinking partner | project | `.pi/skills/openspec-explore/SKILL.md` |
| openspec-propose | Propose new change with artifacts | project | `.pi/skills/openspec-propose/SKILL.md` |
| ast-grep | Search/replace code patterns semantically | user | `~/.pi/agent/npm/node_modules/pi-lens/skills/ast-grep/SKILL.md` |
| lsp-navigation | Code intelligence, diagnostics, type checks | user | `~/.pi/agent/npm/node_modules/pi-lens/skills/lsp-navigation/SKILL.md` |
| caveman | Ultra-compressed communication | user | `~/.agents/skills/caveman/SKILL.md` |
| caveman-commit | Ultra-compressed commit messages | user | `~/.agents/skills/caveman-commit/SKILL.md` |
| caveman-review | Ultra-compressed code reviews | user | `~/.agents/skills/caveman-review/SKILL.md` |
| caveman-help | Caveman quick reference | user | `~/.agents/skills/caveman-help/SKILL.md` |
| caveman-compress | Compress memory files | user | `~/.agents/skills/caveman-compress/SKILL.md` |
| compress | Compress natural language files | user | `~/.agents/skills/compress/SKILL.md` |
| branch-pr | Create PRs with checks | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/branch-pr/SKILL.md` |
| chained-pr | Split oversized PRs | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/chained-pr/SKILL.md` |
| gentle-ai | Harness discipline for Pi work | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/gentle-ai/SKILL.md` |
| work-unit-commits | Plan commits as work units | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/work-unit-commits/SKILL.md` |
| cognitive-doc-design | Docs that reduce cognitive load | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/cognitive-doc-design/SKILL.md` |
| comment-writer | PR feedback, issue replies | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/comment-writer/SKILL.md` |
| issue-creation | GitHub issues, bug reports | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/issue-creation/SKILL.md` |
| judgment-day | Dual adversarial review | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/judgment-day/SKILL.md` |
| release | Release via GitHub + npm | user | `~/.pi/agent/npm/node_modules/gentle-pi/skills/release/SKILL.md` |
| composio-cli | Composio CLI operations | user | `~/.agents/skills/composio-cli/SKILL.md` |
| find-skills | Discover installable skills | user | `~/.agents/skills/find-skills/SKILL.md` |
| web-design-guidelines | UI code review for best practices | user | `~/.agents/skills/web-design-guidelines/SKILL.md` |

## Stats

- **24 skills** indexed
- **5 project-level** (`.pi/skills/`)
- **19 user-level** (agent packages + user skills)
- **Skipped**: pi-subagents, pi-intercom (internal packages), skill-registry (self)
- **Generated**: 2026-05-22
