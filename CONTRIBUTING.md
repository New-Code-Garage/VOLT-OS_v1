# CONTRIBUTING.md — VOLT OS

Thank you for contributing to VOLT OS!

---

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/my-feature`
5. Make your changes
6. Run tests: `pnpm test`
7. Commit: `git commit -m "feat: add my feature"`
8. Push: `git push origin feature/my-feature`
9. Open a Pull Request

---

## Development Rules

### Code Style
- TypeScript strict mode
- No `any` types
- `.js` import extensions
- Prettier formatting

### Testing
- Write tests for new features
- Maintain ≥80% coverage
- Run full test suite before PR

### Commits
- Use conventional commits
- Reference issues: `fixes #123`
- Keep commits atomic

### Pull Requests
- One feature per PR
- Include description
- Link related issues
- Request review from maintainers

---

## Architecture

Read `docs/ARCHITECTURE.md` before contributing.

Key principles:
- Event-driven architecture
- Plugin-based extensibility
- Capability-based scheduling
- Default-deny security

---

## Code of Conduct

Be respectful, inclusive, and professional.

See `CODE_OF_CONDUCT.md`.
