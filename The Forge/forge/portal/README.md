# Forge Portal

Mobile-first control room for the Forge governance system.

## What It Is

The Forge Portal is a static HTML/CSS dashboard designed for phone-first governance. It provides:

- **Quick Actions**: Create Work Orders, view open issues, check PRs
- **System Status**: At-a-glance view of Forge and MyFi runtime state
- **Navigation**: Direct links to key documents and codebase locations
- **Activity Feed**: Recent Work Order completions (currently static)

## How to Use

### Local Development

Open `index.html` directly in a browser:

```bash
# From repo root
open "The Forge/forge/portal/index.html"
```

Or use any static server:

```bash
cd "The Forge/forge/portal"
python -m http.server 8080
# Then visit http://localhost:8080
```

### Mobile Testing

1. Serve locally with a static server
2. Use browser DevTools device emulation
3. Or access via local network on your phone

### GitHub Pages Deployment

The portal is Pages-ready. To deploy:

1. Enable GitHub Pages in repository settings
2. Set source to the appropriate branch/folder
3. Portal will be available at `https://<user>.github.io/projectExodus/The%20Forge/forge/portal/`

## File Structure

```
portal/
├── index.html    # Main portal page
├── styles.css    # Mobile-first styles
└── README.md     # This file
```

## Design Decisions

- **Mobile-first**: 320px base, scales up
- **Dark theme**: Matches MyFi cosmic aesthetic
- **Touch-friendly**: 44px minimum touch targets
- **No JavaScript dependencies**: Pure vanilla JS for timestamp only
- **No API calls**: Static links only (M2b may add live data)
- **Safe area support**: Works on notched phones
- **Reduced motion**: Respects user preferences

## Links Configured

| Action | Target |
|--------|--------|
| Create Work Order | GitHub Issue Form (forge_work_order.yml) |
| Open Work Orders | Issues filtered by `work-order` label |
| Pull Requests | Repository PR list |
| Share Pack | exports/ directory in Forge |
| Product State | PRODUCT_STATE.md in myfi/ |
| Parity Matrix | MIGRATION_PARITY_MATRIX.md |
| Forge Kernel | FORGE_KERNEL.md |
| Canonical Codebase | ProjectMyFi_vLatest/ |

## Future Enhancements (M2b+)

- Live issue count via GitHub API
- Real-time status checks
- Share Pack sync indicator
- Work Order approval flow
- Activity feed from commits/issues

## Related Work Orders

- **M2a**: Created this portal and GitHub Issue Form
- **M2b** (planned): Build automation and deployment
