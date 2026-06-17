# Portfolio notes

Your canonical copy: **https://github.com/potsy017/volleyball-performance-analytics** (public).

## Demo deploy

See **[docs/DEPLOY_DEMO.md](docs/DEPLOY_DEMO.md)** — Railway (2 services) or Render blueprint.

## Security checklist (public repo)

- [x] No `.env` or roster `.xlsx` in git
- [ ] Rotate Supabase service role if keys were ever shared
- [ ] Demo Supabase uses anonymised athlete data
- [ ] `AUTH_ENABLED=false` only on demo hosts

## Removed from client handover

Handover docs, client CI workflow, and roster workbooks were stripped before portfolio publish.
