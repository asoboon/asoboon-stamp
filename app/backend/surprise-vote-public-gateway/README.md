# ASOBooN Surprise Vote Public Gateway

Public read-only cache for the surprise-vote status used by the legacy/public HOME.

- Worker: `asoboon-surprise-vote-public-gateway`
- D1: `asoboon-surprise-vote-public-db`
- Origin: the dedicated surprise-vote Apps Script `action=status`
- Browser API: `GET ?action=status`, `GET ?action=health`
- Cron: every minute
- Secrets: none
- AirWAIT access: none
- LINE access: none

The browser receives only the public status. Per-user vote allocation continues to use the dedicated Apps Script directly and is never cached in D1.
