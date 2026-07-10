# SECURITY.md — VOLT OS

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**DO NOT** open a public GitHub issue for security vulnerabilities.

### Contact

Email: security@volt-os.dev (or create a private security advisory on GitHub)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Time

- Acknowledgment: 24 hours
- Initial assessment: 72 hours
- Resolution: 30 days (depending on severity)

---

## Security Measures

### Authentication
- JWT-based authentication
- API key support
- Service account support

### Authorization
- Role-based access control (RBAC)
- Default-deny policy
- Permission-based resource access

### Data Protection
- AES-256 encryption at rest
- TLS encryption in transit
- Secrets never logged

### Supply Chain
- Dependency scanning
- License compliance
- Integrity verification

---

## Scope

This security policy applies to:
- VOLT OS core platform
- Official SDK
- Mission Control
- Documentation

Out of scope:
- Third-party plugins
- Custom deployments
- User-generated content
