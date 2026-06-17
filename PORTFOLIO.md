# Portfolio notes

**Repo:** https://github.com/potsy017/volleyball-performance-analytics (public, source-only)

## Strategy

- **Keep:** GitHub repo as the portfolio artifact (code + docs + CI compile check).
- **Retire:** Supabase, Render, Railway, and other hosted services.
- **Showcase:** LinkedIn screenshots + repo link — see [docs/SHOWCASE.md](docs/SHOWCASE.md).

## Decommission checklist

- [ ] Delete/pause Supabase project; rotate keys that were in local `.env`
- [ ] Delete Render services (if any)
- [ ] Delete Railway services (dashboard, WHOOP bridge)
- [ ] Remove GitHub Actions secrets on any old org repos
- [ ] Remove WHOOP redirect URIs for deleted hosts
- [ ] Confirm no secrets in git history (`git log -p` spot-check)

## In git

- No `.env`, no roster `.xlsx`, no client handover docs
- Deploy configs (`render.yaml`, `railway.toml` at repo root) removed — hosting not maintained
