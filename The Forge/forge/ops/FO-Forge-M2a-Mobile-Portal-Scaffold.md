# WORK ORDER: FO-Forge-M2a-Mobile-Portal-Scaffold

Status: Executed
Executed: 2026-01-23
Executor: Claude (Opus 4.5)
Director Approval: Approved with intent statement

---

## Task ID
FO-Forge-M2a-Mobile-Portal-Scaffold

## Task Type
implementation

## Intent Statement
Make "phone-first governance" real by adding GitHub Issue Form for Work Orders and a live Portal UI scaffold that is mobile-native and links into the system.

## Scope of Work
1. GitHub Issue Form capturing all Work Order fields
2. Portal UI scaffold (static site) with:
   - Links to Create Work Order, Open Work Orders, PRs, Share Pack, MyFi Product State
   - System status panel (static placeholders)
   - Quick Actions section
   - Mobile-first responsive design
   - Pages-ready structure

## Allowed Files / Artifacts
- CREATE: `.github/ISSUE_TEMPLATE/forge_work_order.yml`
- CREATE: `The Forge/forge/portal/index.html`
- CREATE: `The Forge/forge/portal/styles.css`
- CREATE: `The Forge/forge/portal/README.md`

## Forbidden Changes
- No GitHub Actions automation (save for M2b)
- No API tokens
- No backend

## Success Criteria
- Work Order Issue Form exists and works on mobile
- Portal UI renders nicely on phone and provides key control-room links
- No automation yet, but everything is deployable as static

## Dependencies
- I1 and I2 completed (for accurate status display)
- S1 completed (for accurate Product State links)

---

## Deliverables

### 1. GitHub Issue Form
**File:** `.github/ISSUE_TEMPLATE/forge_work_order.yml`

Fields captured:
- Task ID (required)
- Task Type (dropdown: implementation, spec-sync, uplift, refactor, audit, research, docs-only, meta)
- Intent Statement (required)
- Scope of Work (required)
- Allowed Files / Artifacts (required)
- Forbidden Changes (required)
- Success Criteria (required)
- Dependencies (optional)
- Execution Mode (dropdown: code, docs-only)
- Share Pack refresh required (checkbox)
- Director Approval (checkbox)
- Additional Notes (optional)

Auto-labels: `work-order`, `pending-approval`

### 2. Portal UI
**Directory:** `The Forge/forge/portal/`

**Features:**
- Mobile-first design (320px base)
- Dark cosmic theme (matches MyFi aesthetic)
- Touch-friendly (44px minimum targets)
- Safe area support for notched phones
- Reduced motion support

**Sections:**
- Header with logo and online status
- System Status panel (4-item grid)
- Quick Actions (4 buttons: Create WO, Open WOs, PRs, Share Pack)
- Navigation (5 links to key docs/codebase)
- Recent Activity (static feed showing I1, I2, S1)
- Footer with timestamp

**Technical:**
- Pure static HTML/CSS/JS
- No external dependencies
- Pages-ready (self-contained)
- ~200 lines HTML, ~400 lines CSS

---

## Review & Reflection Notes
- Clean implementation following mobile-first principles
- Issue form captures all TASK_WORK_ORDER.md fields in structured format
- Portal provides immediate value as phone control room
- Ready for M2b to add deployment automation
- Future enhancement: live data via GitHub API (requires auth)

End of Work Order.
