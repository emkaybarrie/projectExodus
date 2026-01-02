# Surfaces Studio (v1)

Goal: a safe, deterministic UI composition + uplift workflow tool.

This v1 uses a copy/paste AI workflow:
- Studio shows a minimal "AI Pack" (prompt + contract + editable uplift file contents).
- You paste into ChatGPT.
- You paste the returned file contents back into Studio.
- Studio writes ONLY to allowlisted files and re-validates.

Source of truth:
- `src/ui/manifest.json` lists screens, mountable kinds, and UI uplift packs.

Write allowlist:
- surface.json
- screen uplift.css
- part uplift.css / uplift.html

Anything else is read-only.
