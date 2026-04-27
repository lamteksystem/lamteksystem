# Customer ordering – regression matrix (manual QA)

Use this as a repeatable checklist. Mark **Pass/Fail** and capture notes (especially for pricing + auth edge cases).

Legend:
- **Pre**: required setup
- **Steps**: user actions
- **Expect**: must be true for Pass

## Smoke flows

| ID | Area | Pre | Steps | Expect |
| --- | --- | --- | --- | --- |
| R1 | Login | customer user exists | Login | lands on customer dashboard |
| R2 | Empty cart | no draft lines | Open `/ordering/cart` | empty-state offers navigation to `/ordering` |
| R3 | Add product | products load | `/ordering` → add any in-stock product | line appears in cart; totals update |
| R4 | Place order | Stripe test mode works | cart → place order flow | order created; status progresses as designed |

## Guided wizard + persistence

| ID | Area | Pre | Steps | Expect |
| --- | --- | --- | --- | --- |
| R5 | Wizard entry | authenticated | Open `/ordering?flow=guided` | wizard renders; can pick stock vs MTO |
| R6 | Stock path | authenticated | wizard: stock → pick range → pick mode → complete project | navigates to `/ordering?type=stock&range=...&mode=...` |
| R7 | MTO redirect | authenticated | wizard: choose MTO | redirects to `/ordering/mto` |
| R8 | prefs hydrate | user has `ordering_last_state_v1` preference from prior session | Open `/ordering` with **no** explicit guidance params | last mode/filters/search restore (best effort) |

## Checklist deep-links (from cart)

| ID | Area | Pre | Steps | Expect |
| --- | --- | --- | --- | --- |
| R9 | Component checklist link | cart has items; checklist renders | Click a checklist “add” link (components) | lands on `/ordering` with guidance banner; search prefilled |
| R10 | Complete checklist link | checklist renders | Click a checklist “units” link (complete) | lands with `mode=complete` + assembly search prefilled |
| R11 | Try next suggestion | `suggestions` has 2+ terms | Click “Try next suggestion” | cycles `suggestionIndex` and updates `search` or `assemblySearch` |
| R12 | Clear guidance | guidance present | Click “Clear guidance” | removes checklist/search/suggestion params from URL |
| R13 | Restore defaults | guidance present | Click “Restore defaults” | clears local filters/search; resets saved preference snapshot |

## Basket switching

| ID | Area | Pre | Steps | Expect |
| --- | --- | --- | --- | --- |
| R14 | Switch basket | multiple draft orders exist | Use basket dropdown on `/ordering` and `/ordering/cart` | active basket changes; line list reflects selection |

## Pricing / totals sanity

| ID | Area | Pre | Steps | Expect |
| --- | --- | --- | --- | --- |
| R15 | Reprice on add | customer pricing rules exist | Add item | unit prices and totals match expected customer pricing |

## Failure/edge expectations (non-blocking but note)

- **E1**: If prefs JSON is malformed, ordering should still load (prefs ignored).
- **E2**: If checklist resolution finds no match, UI should remain usable (no hard crash).
