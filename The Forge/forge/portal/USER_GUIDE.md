# Forge Portal User Guide

**For Directors, Architects, and Operators**

---

## What is Forge?

Forge is the **Institutional Operating System** that governs all software development within the Forante network. It is not a product — it is the SDLC (Software Development Lifecycle) that ensures quality, traceability, and constitutional compliance across all entities like MyFi.

The **Forge Portal** (also called "Forante OS Console") is your mobile-friendly control plane for:
- Managing Work Orders (the unit of work in Forge)
- Approving and tracking execution progress
- Coordinating between human Directors and AI Agents
- Monitoring deployment status across environments

---

## The 9-Phase Work Order Lifecycle

Every Work Order flows through these phases:

| Phase | Who | What Happens |
|-------|-----|--------------|
| 1. **Draft** | Architect | WO created, scope defined |
| 2. **Approved** | Director | Director reviews and approves |
| 3. **Queued** | Forge | WO added to executor queue |
| 4. **Executing** | Executor | AI or human implements |
| 5. **Verified** | Verifier-Tester | Changes tested and verified |
| 6. **Deployed Dev** | Automation | Merged to dev, deployed |
| 7. **Promoted** | Director | Director approves for prod |
| 8. **Deployed Prod** | Automation | Merged to main, live |
| 9. **Observed** | Reporter | Metrics collected, evolution proposed |

---

## Daily Operating Loop

```
Create WO → Approve → Execute → Verify → Deploy Dev → Promote → Deploy Prod → Observe → Evolve
```

1. **Create a Work Order** — Draft the scope of work
2. **Approve** — Director reviews and approves
3. **Execute** — AI agent or human implements
4. **Verify** — Tester validates the changes
5. **Deploy to Dev** — Automated deployment to dev environment
6. **Promote** — Director approves for production
7. **Deploy to Prod** — Automated deployment to main/prod
8. **Observe** — Check metrics, gather feedback
9. **Evolve** — Propose improvements, create new WOs

---

## How to Use the Portal

### Navigate the Portal

The Portal has 4 main tabs (bottom navigation on mobile):

| Tab | Purpose |
|-----|---------|
| **Home** | System status, quick navigation, settings |
| **Forge OS** | Work Orders, agents, deployments |
| **Entities** | Products under governance (e.g., MyFi) |
| **Governance** | Constitutional documents, Model 3 architecture |

### Create a Work Order

1. Go to **Forge OS** tab
2. Tap **+ Create WO**
3. Fill in the form:
   - **Task ID**: Use format `FO-[Entity]-[Type][Num]-[Name]` (e.g., `FO-MyFi-I3-AddLogin`)
   - **Task Type**: Implementation, Spec Sync, Refactor, etc.
   - **Intent**: WHY this task exists (one sentence)
   - **Scope**: What will be done
   - **Allowed Files**: Files that may be modified
   - **Forbidden Changes**: What's out of scope
   - **Success Criteria**: How we know it's done
4. Choose an action:
   - **Open in GitHub** — Creates GitHub Issue with form data
   - **Copy Markdown** — Copies WO as markdown for manual creation

### Approve or Reject a Work Order

1. Go to **Forge OS** → **View Forge WOs**
2. Find a WO with **Pending** status
3. Tap to open the WO detail modal
4. In **Director Actions**:
   - **With PAT configured**: Tap **Approve** or **Reject** directly
   - **Without PAT**: Tap **Copy Approval** or **Copy Rejection**, then paste in GitHub Issue

### Trigger Share Pack Refresh

The Share Pack is the "truth export" that agents load before working. To refresh it:

1. Go to **Forge OS** → **Share Packs**
2. Tap **Refresh Share Pack**
3. In the modal:
   - **With PAT**: Tap **Trigger Dev Deploy**
   - **Without PAT**: Copy the CLI command or open Actions manually

### Copy Agent Pack for Non-Repo AI

To use a non-repo-aware AI (like Claude.ai web interface):

1. Find the Work Order in **Forge OS** → **View WOs**
2. Tap on the WO card to open details
3. Tap **Copy Agent Pack**
4. Choose a mode:
   - **Full Pack**: Complete context with checklist
   - **Minimal Pack**: Summary only
   - **Context Only**: Governance references only
5. Paste into your AI interface
6. AI executes, produces output
7. Come back to Portal → **Forge OS** → **Agents** → **Import Agent Output**
8. Paste the output, select WO, save or post to GitHub

### View Observations / Deploy Status

1. Go to **Forge OS** tab
2. Scroll down to see:
   - **Observed Panel**: Latest smoke test results
   - **Deployment Status Panel**: Current environment state

If observations are missing, the panel will show guidance to run a deploy.

### Promote to Production

1. Go to **Forge OS** tab
2. In **Quick Actions**, tap **Deploy to Prod**
3. This opens the GitHub Actions page for `forge-deploy-to-prod.yml`
4. Click "Run workflow" on GitHub to create a PR from dev → main

---

## Configuring GitHub PAT

A Personal Access Token (PAT) enables direct API actions from the Portal.

### What a PAT Enables

| Feature | Without PAT | With PAT |
|---------|-------------|----------|
| View Work Orders | Yes | Yes |
| Copy Agent Packs | Yes | Yes |
| Create WO (draft) | Yes | Yes |
| Approve/Reject WO | Copy command | Direct |
| Trigger Share Pack Refresh | Manual | Direct |
| Post Agent Output to GitHub | Copy | Direct |

### How to Configure

1. Go to **Home** → **Settings**
2. Read the **Security Notice**
3. Tap **Configure PAT**
4. Acknowledge the security risks (token stored in browser)
5. Paste your GitHub PAT
6. Tap **Save Token**

### Create a Fine-Grained PAT

1. Go to [GitHub Settings → Tokens (Fine-grained)](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Set:
   - **Token name**: "Forge Portal"
   - **Expiration**: 90 days recommended
   - **Repository access**: Select your projectExodus repo
   - **Permissions**:
     - **Issues**: Read and write
     - **Actions**: Read and write (for workflow dispatch)
4. Generate and copy the token
5. Paste in Portal Settings

### How to Forget Your Token

1. Go to **Home** → **Settings**
2. Tap **Forget Token**
3. Token is removed from localStorage immediately

---

## Troubleshooting

### PAT Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No GitHub PAT configured" | PAT not set | Go to Settings, configure PAT |
| "GitHub API error 401" | Token expired or invalid | Create new PAT, update in Settings |
| "GitHub API error 403" | Insufficient permissions | Check PAT scopes (needs `issues:write`) |
| "GitHub API error 404" | Issue not found or no access | Verify issue exists and PAT has repo access |

### Missing Issue Number in WO

**Problem:** "Cannot approve: No GitHub Issue linked"

**Cause:** The WO markdown file doesn't contain an Issue reference.

**Solution:**
1. Open the WO file in the repo
2. Add a line: `Issue: #123` (with actual issue number)
3. Trigger Share Pack refresh
4. WO will now have the linked issue

### Observations Missing / Stale

**Problem:** "Observations not available" error in Portal

**Cause:** No deployment has run, or deployment failed.

**Solution:**
1. Go to **Forge OS** → **Share Packs** → **Refresh Share Pack**
2. Or manually trigger `forge-pages-deploy.yml` in GitHub Actions
3. Wait for deployment to complete
4. Refresh Portal

### Workflow Dispatch Failures

**Problem:** Share Pack refresh or other dispatch shows error

**Causes:**
- PAT lacks `actions:write` permission
- Workflow file doesn't exist
- Branch protection rules

**Solutions:**
1. Verify PAT has Actions write permission
2. Check workflow file exists in repo
3. Use manual fallback (copy CLI command or open Actions page)

---

## Security Notes

### PAT Storage

Your GitHub PAT is stored in your browser's **localStorage**. This means:

- **Unencrypted**: Anyone with access to your browser can read it
- **Per-device**: You need to configure on each device
- **Browser-specific**: Different browsers have separate storage
- **Only to GitHub**: The Portal only sends your PAT to `api.github.com`

### Best Practices

1. **Use fine-grained PATs** with minimal permissions
2. **Set expiration** (90 days recommended)
3. **Only use on trusted devices**
4. **Forget token** when done with sensitive operations
5. **Rotate regularly** and revoke old tokens

### What the Portal Never Does

- Sends your PAT to any server other than GitHub
- Stores your PAT on any server
- Logs your PAT anywhere
- Shares your PAT with third parties

---

## Glossary

| Term | Definition |
|------|------------|
| **Work Order (WO)** | The atomic unit of work in Forge |
| **Director** | Human authority who approves/rejects WOs |
| **Executor** | AI or human who implements approved WOs |
| **Share Pack** | Constitutional truth export for agents |
| **Agent Pack** | WO-specific context bundle for execution |
| **PAT** | Personal Access Token for GitHub API |
| **Repo-aware** | Agent with direct repository access |
| **Non-repo-aware** | Agent working via copy-paste (no repo access) |

---

## Quick Reference

### Keyboard Shortcuts

The Portal is touch-optimized. No keyboard shortcuts are implemented.

### Useful Links

- [GitHub Actions](https://github.com/emkaybarrie/projectExodus/actions)
- [Executor Queue](https://github.com/emkaybarrie/projectExodus/issues?q=is%3Aissue+is%3Aopen+label%3Aready-for-executor)
- [Create PAT](https://github.com/settings/tokens?type=beta)
- [Forge Kernel](https://github.com/emkaybarrie/projectExodus/blob/main/The%20Forge/forge/FORGE_KERNEL.md)
- [Executor Playbook](https://github.com/emkaybarrie/projectExodus/blob/main/The%20Forge/forge/ops/EXECUTOR_PLAYBOOK.md)

---

*Last Updated: 2026-01-29*
