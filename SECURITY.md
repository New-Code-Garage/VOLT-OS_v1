# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within VOLT OS, please send an email to security@volt-os.dev. All security vulnerabilities will be promptly addressed.

**Please do NOT report security vulnerabilities through public GitHub issues.**

## Disclosure Policy

When the security team receives a security bug report, it will be assigned to a primary handler. This person will coordinate the fix and release process:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all releases still under maintenance
4. Release new versions
5. Publish a security advisory on GitHub

## Security Considerations

### Agent Security
- Agents run in sandboxed environments with limited permissions
- All agent actions are logged and auditable
- Agent memory is isolated per-agent

### Model Router Security
- API keys are encrypted at rest using envelope encryption (KMS)
- Keys are never stored in environment variables or source code
- All model provider communication uses TLS

### Plugin Security
- Plugins run in worker thread sandboxes
- Plugin permissions are declared and enforced at runtime
- Plugin code is scanned for known vulnerabilities before activation

### Pipeline Security
- Human approval gates are required for critical actions
- All pipeline actions are logged in the audit trail
- Audit log uses hash chaining for tamper protection

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x (alpha) | ✅ Active development |
| < 0.1 | ❌ Not supported |
