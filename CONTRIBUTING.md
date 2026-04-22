# Contributing

Thanks for your interest. A few ground rules to keep the project clean:

1.  **Open an issue first** for non-trivial changes so design can be discussed.
2.  **Never commit secrets.** `.env` files and API keys must stay local.
3.  **Keep risk logic auditable.** Pull requests that touch sizing, leverage,
    or order submission paths need tests and a written rationale.
4.  **Match the existing style.** No sweeping reformat-only changes.
5.  **Every commit should build.** If there is a test suite, it must pass.

## Pull request checklist
- [ ] Tests added / updated where reasonable.
- [ ] README / docs updated where behaviour or configuration changes.
- [ ] No secrets, no production data, no private keys.
- [ ] Commit messages describe the *why*, not just the *what*.
