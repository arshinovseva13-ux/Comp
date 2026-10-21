# Security status

This is an early prototype, not hardened production software.
- Do not expose the backend to the public internet without authentication, rate limits, CSRF/origin checks and sandboxing.
- Never commit .env or place API keys in frontend code.
- Use a disposable workspace, not your home directory or a folder containing secrets.
- Agent tools can change files and may run commands. Keep agent execution disabled until permissions and isolation are reviewed.
- Treat repository files and model output as untrusted input.
- API usage may incur charges. The app does not provide Claude credits.
- APK debug builds are not production signed.
