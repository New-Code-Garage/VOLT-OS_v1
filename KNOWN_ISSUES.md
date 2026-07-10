# KNOWN_ISSUES.md — VOLT OS

Version: 1.0
Last Updated: 2026-07-10

---

## Known Issues

### P0 Critical
None reported.

### P1 High
None reported.

### P2 Medium
| ID | Description | Workaround |
|----|-------------|------------|
| KI-001 | Mission Control WebSocket reconnect may delay on slow networks | Wait 5 seconds for reconnection |
| KI-002 | Large pipelines (>20 stages) may timeout | Split into smaller pipelines |

### P3 Low
| ID | Description | Workaround |
|----|-------------|------------|
| KI-003 | Dark mode only, no light mode | None (by design) |
| KI-004 | No mobile optimization | None (desktop only) |

---

## Reporting Issues

Use GitHub Issues with the bug report template.

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details

---

## Priority Definitions

| Priority | Definition |
|----------|------------|
| P0 Critical | System unusable, data loss, security breach |
| P1 High | Major feature broken, no workaround |
| P2 Medium | Feature degraded, workaround available |
| P3 Low | Minor issue, cosmetic, enhancement |
