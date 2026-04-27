# Guided ordering – acceptance criteria (current implementation)

This document describes **expected behavior** for the guided ordering experience as implemented in:

- `src/pages/Ordering.tsx`
- `src/components/OrderingWizard.tsx`
- `src/pages/OrderCart.tsx` (checklist deep-links)
- `src/lib/checklistRouting.ts` + `src/lib/orderChecklist.ts`
- `src/lib/userPreferences.ts` (persistent prefs; **no `localStorage`**)

## Routes

- Customer ordering surface: `/ordering`
- Guided wizard: `/ordering?flow=guided` (also used as a “back to guided setup” target)
- Cart / checkout review: `/ordering/cart`
- MTO area: `/ordering/mto` (redirected from wizard when type is MTO)

## Wizard (`/ordering?flow=guided`)

### Entry / visibility

- **AC-W1**: When `flow=guided` and **no** `type` is present, the user sees the **OrderingWizard** (type selection).
- **AC-W2**: When `flow=guided` and `type=stock` but **range or mode is missing**, the user sees the **OrderingWizard** until both are chosen.
- **AC-W3**: When `type=mto` is chosen in the wizard, the app **redirects** to `/ordering/mto` (MTO is not range-based).

### Wizard completion hand-off

- **AC-W4**: Completing the wizard for stock navigates to `/ordering?type=stock&range=<uuid>&mode=<component|complete>` with the chosen parameters.
- **AC-W5**: Project setup persists per basket via `order_project_<orderId>` in `user_preferences` (see `src/lib/orderProject.ts`).

## Ordering page (`/ordering` with workflow params)

### “Workflow complete” definition

For stock ordering, “workflow complete” is:

- `type=stock`
- `range=<uuid>`
- `mode` is `component` or `complete`

### Navigation expectations

- **AC-O1**: When workflow is complete, the page back navigation uses `"/ordering?flow=guided"` with label **“Change order type or range”**.
- **AC-O2**: When workflow is not complete, the page back navigation uses `"/"` with label **“Dashboard”**.

### Checklist deep-links from cart

Cart links are generated in `OrderCart.tsx` as:

- Components mode: `mode=component&checklist=<groupId>&search=<term>&suggestions=...&suggestionIndex=0`
- Complete mode: `mode=complete&checklist=<groupId>&assemblySearch=<term>&suggestions=...&suggestionIndex=0`

**AC-C1**: Deep-linking from cart sets `mode` and applies checklist-driven resolution:

- In **component** mode: `checklist` resolves a best-effort category selection via `resolveChecklistCategoryId(...)` **only when** `range` is not present and no category is already selected.
- In **complete** mode: `checklist` resolves assembly filters via `resolveChecklistAssemblyFilters(...)` **only when** `assemblyTypeFilter` and `assemblyCollectionFilter` are empty.

**AC-C2**: When `search` / `assemblySearch` / `checklist` hints are present, the UI shows the **guidance banner** (“Checklist guidance applied …”).

**AC-C3**: “Try next suggestion” cycles `suggestionIndex` and updates `search` (component) or `assemblySearch` (complete) when `suggestions` contains 2+ terms.

**AC-C4**: “Clear guidance” removes `checklist`, `search`, `assemblySearch`, `suggestions`, and `suggestionIndex` from the URL.

**AC-C5**: “Restore defaults”:
- resets local UI state to defaults (mode `component`, clears searches/filters, category defaults to `range` if present),
- removes guidance-related query params,
- **deletes `mode` from the URL** (so the URL may no longer reflect component/complete until user changes mode again),
- writes a fresh `ordering_last_state_v1` preference snapshot.

## Persistent last state (non-`localStorage`)

Preference key: `ordering_last_state_v1` (see `Ordering.tsx`).

**AC-P1**: If the URL has **no explicit guidance** (`mode`, `range`, `search`, `assemblySearch`, `checklist`, `suggestions`), then on load the page hydrates `mode`, category selection, and search/filter fields from `ordering_last_state_v1` (best-effort JSON parse).

**AC-P2**: If explicit guidance is present, hydration from preferences is skipped, and preference persistence is also skipped until guidance is removed.

**AC-P3**: After hydration completes, changes to ordering UI state persist back to `ordering_last_state_v1` (throttled by React effect lifecycle).

## Project panel

- **AC-PR1**: If a project exists for the active basket draft order, it is shown with an **Edit** link to `/ordering?flow=guided`.
