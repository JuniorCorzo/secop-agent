# Skill Registry — secop-agent

*Generated: 2026-05-14 | Mode: engram | SDD Init: completed*

## Project Conventions

| File | Purpose |
|------|---------|
| `AGENTS.md` | Project agent rules (stack, commands, gotchas, patterns) |
| `CONVENTIONS.md` | SOLID/YAGNI/KISS conventions |
| `openspec/config.yaml` | SDD project config (spec-driven schema) |

## Available Skills

### SDD Workflow
| Skill | Trigger | Source |
|-------|---------|--------|
| sdd-init | "sdd init", initialize project | opencode |
| sdd-explore | Explore ideas before change | opencode |
| sdd-propose | Create change proposal | opencode |
| sdd-design | Write technical design | opencode |
| sdd-spec | Write specifications | opencode |
| sdd-tasks | Break into task checklist | opencode |
| sdd-apply | Implement tasks | opencode |
| sdd-verify | Validate implementation | opencode |
| sdd-archive | Archive completed change | opencode |
| sdd-onboard | Guided SDD walkthrough | claude |
| openspec-apply-change | Implement OpenSpec change | project |
| openspec-explore | OpenSpec explore mode | project |
| openspec-propose | OpenSpec propose change | project |
| openspec-archive-change | OpenSpec archive change | project |

### Git & PR
| Skill | Trigger | Source |
|-------|---------|--------|
| commit-work | Commit, stage, split commits | opencode |
| branch-pr | Create PR, open PR | opencode |
| issue-creation | Create GitHub issue | opencode |

### Code Quality
| Skill | Trigger | Source |
|-------|---------|--------|
| audit | Accessibility/perf/quality audit | opencode |
| judgment-day | Adversarial dual review | opencode |
| caveman-review | Compressed PR review | agents |
| go-testing | Go test patterns | opencode, claude |

### Design & UX
| Skill | Trigger | Source |
|-------|---------|--------|
| frontend-design | Build web UI components | claude, project |
| impeccable | Production-grade UI | opencode |
| shape | Plan UX before code | opencode |
| layout | Fix spacing/hierarchy | opencode |
| colorize | Add strategic color | opencode |
| typeset | Fix typography | opencode |
| animate | Add motion/micro-interactions | opencode |
| delight | Add joy/personality | opencode |
| distill | Remove complexity | opencode |
| bolder | Amplify safe designs | opencode |
| quieter | Tone down aggressive designs | opencode |
| polish | Final quality pass | opencode |
| harden | Production-ready edge cases | opencode |
| optimize | UI performance tuning | opencode |
| overdrive | Push past limits | opencode |
| clarify | Improve UX copy/labels | opencode |
| adapt | Responsive/breakpoints | opencode |
| accessibility | WCAG audit | project |
| critique | UX evaluation | opencode |
| seo | Search engine optimization | project |
| web-design-guidelines | UI best practices audit | agents |

### Backend & Stack
| Skill | Trigger | Source |
|-------|---------|--------|
| nestjs-best-practices | NestJS patterns | project |
| bun | Bun runtime tasks | project |
| vite | Vite config/plugins | project |
| tailwind-css-patterns | Tailwind CSS patterns | project |
| typescript-advanced-types | TS advanced types | project |
| vercel-composition-patterns | React composition patterns | project |
| vercel-react-best-practices | React/Next.js perf | project |

### Memory & Utility
| Skill | Trigger | Source |
|-------|---------|--------|
| caveman | Token-efficient communication | agents |
| caveman-commit | Compressed commits | agents |
| caveman-compress | Compress memory files | agents |
| caveman-help | Caveman reference card | claude |
| skill-creator | Create new agent skills | opencode, claude |
| find-skills | Discover installable skills | agents |
| para-memory-files | PARA file-based memory | claude |
| paperclip | Paperclip coordination | claude |
| paperclip-create-agent | Create Paperclip agents | claude |
| paperclip-create-plugin | Create Paperclip plugins | claude |

## Stack-Specific Notes

- **NestJS backend**: Use `nestjs-best-practices` skill for all backend code
- **React frontend**: Use `vercel-react-best-practices` + `frontend-design` for UI work
- **Testing**: Strict TDD enabled — write tests first for NestJS (Jest); frontend has NO test runner yet
- **Styling**: TailwindCSS 4 — use `tailwind-css-patterns` skill
- **Package manager**: Bun 1.3 — use `bun` skill for runtime tasks
- **Build**: FORBIDDEN by convention — never run `bun run build`