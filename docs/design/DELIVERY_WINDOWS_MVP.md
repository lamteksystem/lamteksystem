# Delivery windows (MVP) – proposed data model + flow

## Goals (MVP)

- Allow choosing a **delivery window** for courier delivery orders (not collection).
- Support a **cut-off** time after which the earliest available window moves to the next day.
- Provide customer-facing confirmation text (“Your delivery window is …”).

## What already exists

- `orders.delivery_expected_date date` (expected delivery date) – useful display field, but not a window.
- `orders.courier text` – carrier selection.

## Proposed model

### 1) `delivery_windows` (catalog / templates)

Create `public.delivery_windows`:

- `id uuid primary key`
- `name text not null` (e.g. “AM”, “PM”, “All day”)
- `start_time time not null`
- `end_time time not null`
- `timezone text not null default 'Europe/London'`

### 2) `delivery_service_days` (which weekdays each window is offered)

Create `public.delivery_service_days`:

- `id uuid primary key`
- `weekday int not null check (weekday between 0 and 6)` (define convention in code)
- `window_id uuid not null references delivery_windows(id) on delete cascade`
- `cut_off_time time not null` (local cut-off for “ship/build day” decisions)
- `lead_time_days int not null default 0` (optional)

### 3) `orders` linkage

Add to `public.orders`:

- `delivery_window_id uuid references public.delivery_windows(id) on delete set null`
- `delivery_scheduled_date date null` (the customer-selected calendar day for the window)

**Display rule (MVP):**

- Customer sees: `delivery_scheduled_date` + window `name` + `start_time`–`end_time`.

## Cut-off logic (MVP)

Define a pure function in the app layer first:

- Inputs: `now`, selected `weekday`, `cut_off_time`, chosen `delivery_scheduled_date`
- Output: boolean **allowed** + optional message if moved to next eligible day

Store server-side validation as a follow-up (post-MVP) once rules stabilize.

## Relationship to shipments

- For MVP, shipments can remain separate; scheduling is an order-level promise.
- Later: generate `shipments` when despatched, possibly multiple partials.

## Non-goals (MVP)

- Dynamic routing / carrier API booking.
- Multi-stop route optimization.
