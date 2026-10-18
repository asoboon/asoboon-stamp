# Public cache prewarming: workflow input contract

Production deployment is managed by .github/workflows/deploy-miniapp-v2-production-gateway.yml.

The public_read_prewarm input must have YAML-quoted string options:
- "off" (default; no cron prewarming)
- "on" (read-only crowd/calendar cron prewarming)

Use mode="live" when enabling/disabling the feature. mode="dark" disables reception creation and is not a safe performance rollback.

The deployment health gate must check publicReadPrewarmEnabled against the requested value as well as checking all existing live reception, LINE notification, cancellation, and database readiness flags.

This note exists to prevent another HTTP 422 caused by YAML treating bare "on" and "off" as booleans. No runtime functionality changes in this configuration fix.
