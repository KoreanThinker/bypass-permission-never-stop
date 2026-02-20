# Security Policy

## Supported Versions

Only the latest `main` and latest release are supported for security fixes.

## Reporting a Vulnerability

Do not open public issues for sensitive vulnerabilities.

Use GitHub Security Advisories:

- Go to `Security` tab in this repository
- Click `Report a vulnerability`

Include:

- affected version
- reproduction steps
- impact
- suggested fix (optional)

## Secret Handling

- Never commit tokens, keys, or credentials
- Rotate leaked tokens immediately
- Use GitHub Secrets for CI/CD credentials
