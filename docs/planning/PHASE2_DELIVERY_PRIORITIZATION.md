# Phase 2 – delivery prioritization (`MVP` vs `POST-MVP`)

This tags the Phase 2 items from `docs/MASTER_TODO.md` into a pragmatic build sequence.

## Sequencing principle

1. **Fulfillment choice** (collect vs deliver) must exist before “delivery windows” makes sense.
2. **Customer-visible scheduling** comes before **pricing rules** (pricing needs stable fulfillment inputs).
3. **Partial fulfillment / POD** is operations-heavy; ship after core scheduling works.

## Tags

| Phase 2 item | Tag | Notes |
| --- | --- | --- |
| Click & Collect as a delivery method | `MVP` | See `docs/design/CLICK_COLLECT_MVP.md` |
| Delivery windows + scheduling + customer comms | `MVP` (thin) | Date + window first; comms can start as on-screen copy + email later |
| Delivery pricing rules | `POST-MVP` | Depends on fulfillment method + zone/postcode matrix |
| Multiple deliveries per order (partial fulfillment) | `POST-MVP` | Couples tightly with shipments + inventory |
| Proof-of-delivery & attachments | `POST-MVP` | Often tied to partial fulfillment + carrier integrations |

## Suggested build order inside Phase 2

1. `MVP`: Click & Collect (depot + timestamps + customer copy)
2. `MVP`: Delivery windows (window + scheduled date + cut-off rules v1)
3. `POST-MVP`: Delivery pricing rules
4. `POST-MVP`: Multiple deliveries per order
5. `POST-MVP`: Proof-of-delivery attachments
