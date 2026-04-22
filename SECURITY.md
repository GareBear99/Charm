# Security Policy

## Reporting a vulnerability
Please do **not** open a public issue for security-sensitive findings.

Instead, file a private advisory via GitHub:
`https://github.com/GareBear99/<repo-name>/security/advisories/new`

You can expect an initial acknowledgement within 72 hours.

## Scope
- Remote code execution in any runtime path.
- Secret leakage via logs, telemetry, or error messages.
- Order-submission bugs that bypass configured risk limits.
- Dependency vulnerabilities with a usable exploit path.

## Out of scope
- Losses attributable to market conditions or user configuration.
- Findings that require physical access to an already compromised host.
- Theoretical issues without a demonstrated impact.

## Supported versions
Only the latest `main` branch receives security fixes.
