# Labels Required for Forge Automation

## Status
**Action Required**: Director must create these labels in GitHub UI.

## Required Labels

### 1. `approved`
- **Purpose**: Gates Work Order execution
- **Color**: Suggest `#0e8a16` (green)
- **Description**: "Work Order approved for execution"
- **Used by**: `forge-wo-execute.yml` workflow

### 2. `work-order` (auto-created)
- **Purpose**: Identifies Work Order issues
- **Color**: Suggest `#7057ff` (purple)
- **Description**: "Forge Work Order"
- **Used by**: Issue template auto-label

### 3. `pending-approval` (auto-created)
- **Purpose**: Marks WOs awaiting Director review
- **Color**: Suggest `#fbca04` (yellow)
- **Description**: "Awaiting Director approval"
- **Used by**: Issue template auto-label

## How to Create Labels

1. Go to: https://github.com/emkaybarrie/projectExodus/labels
2. Click "New label"
3. Enter name, description, and color
4. Click "Create label"

## Workflow

1. Director creates Work Order via Issue Form → auto-labeled `work-order` + `pending-approval`
2. Director reviews → removes `pending-approval`, adds `approved`
3. Director (or approver) comments `/execute`
4. Workflow runs if `approved` label present

## Verification

After creating labels, test by:
1. Creating a test Work Order issue
2. Adding `approved` label
3. Commenting `/execute`
4. Checking Actions tab for workflow run

---

**Created by**: M2b Work Order
**Date**: 2026-01-23

Delete this file after labels are created (or mark as RESOLVED).
