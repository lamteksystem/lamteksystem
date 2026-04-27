import { supabase } from '@/lib/supabase'
import type { PermissionRuleRow } from '@/types/database'
import type { StaffProfileRow } from '@/hooks/useStaff'

export type PermissionAction = 'view' | 'edit' | 'create' | 'delete'

interface PermissionCacheEntry {
  rules: PermissionRuleRow[]
  fetchedAt: number
}

let cache: PermissionCacheEntry | null = null

export function clearPermissionRulesCache() {
  cache = null
}

// Built-in fallback defaults. Use rules table for overrides and granular control.
// (We keep admin=allow-all above.)
const STAFF_DEFAULT_ALLOW: Partial<Record<string, Partial<Record<PermissionAction, boolean>>>> = {
  'admin.orders': { view: true, edit: true },
  'admin.catalogue': { view: true, edit: true },
  'admin.stock': { view: true, edit: true },
  'admin.uploads': { view: true, edit: true },
  'admin.pricing': { view: true, edit: true },
  'admin.customers': { view: true },
  'admin.reports': { view: true },
  'accounts.view': { view: true },
  'accounts.receive_payments': { create: true },
  'accounts.adjust_balances': { create: true },
  'tickets.view': { view: true },
  'tickets.manage': { edit: true },
  'admin.settings': { view: true, edit: true },
}

function staffDefaultAllows(scope: string, action: PermissionAction): boolean {
  return STAFF_DEFAULT_ALLOW[scope]?.[action] === true
}

type ConditionAtom = {
  field: string
  op: 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte'
  value: unknown
}

type ConditionExpr =
  | ConditionAtom
  | { all: ConditionExpr[] }
  | { any: ConditionExpr[] }
  | { not: ConditionExpr }

function getConditionFieldValue(field: string, ctx: PermissionContext): unknown {
  switch (field) {
    case 'staff.role':
      return ctx.staff?.role ?? null
    case 'staff.user_id':
      return ctx.staff?.user_id ?? null
    case 'env.weekday':
      return new Date().getDay() // 0-6
    case 'env.hour':
      return new Date().getHours() // 0-23
    default:
      return undefined
  }
}

function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean)
  return [v]
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function evalAtom(atom: ConditionAtom, ctx: PermissionContext): boolean {
  const left = getConditionFieldValue(atom.field, ctx)
  const right = atom.value

  switch (atom.op) {
    case 'eq':
      return left === right
    case 'neq':
      return left !== right
    case 'in':
      return toArray(right).some((v) => v === left)
    case 'not_in':
      return !toArray(right).some((v) => v === left)
    case 'contains':
      return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase())
    case 'starts_with':
      return String(left ?? '').toLowerCase().startsWith(String(right ?? '').toLowerCase())
    case 'ends_with':
      return String(left ?? '').toLowerCase().endsWith(String(right ?? '').toLowerCase())
    case 'gt': {
      const l = asNumber(left)
      const r = asNumber(right)
      return l != null && r != null ? l > r : false
    }
    case 'gte': {
      const l = asNumber(left)
      const r = asNumber(right)
      return l != null && r != null ? l >= r : false
    }
    case 'lt': {
      const l = asNumber(left)
      const r = asNumber(right)
      return l != null && r != null ? l < r : false
    }
    case 'lte': {
      const l = asNumber(left)
      const r = asNumber(right)
      return l != null && r != null ? l <= r : false
    }
    default:
      return false
  }
}

function evalConditionExpr(expr: ConditionExpr, ctx: PermissionContext): boolean {
  if ('all' in expr) return Array.isArray(expr.all) ? expr.all.every((x) => evalConditionExpr(x, ctx)) : false
  if ('any' in expr) return Array.isArray(expr.any) ? expr.any.some((x) => evalConditionExpr(x, ctx)) : false
  if ('not' in expr) return !evalConditionExpr(expr.not, ctx)
  if ('field' in expr && 'op' in expr) return evalAtom(expr, ctx)
  return false
}

function conditionsPass(raw: unknown, ctx: PermissionContext): boolean {
  // Empty conditions means "always allow" for this rule.
  if (raw == null) return true
  if (typeof raw === 'object' && raw !== null && Object.keys(raw as Record<string, unknown>).length === 0) return true

  // Support either:
  // - condition atom/expression directly
  // - wrapped object: { if: <expr> }
  const obj = raw as Record<string, unknown>
  if (obj.if != null) return evalConditionExpr(obj.if as ConditionExpr, ctx)
  return evalConditionExpr(raw as ConditionExpr, ctx)
}

async function loadRules(): Promise<PermissionRuleRow[]> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < 60_000) return cache.rules
  const { data, error } = await supabase
    .from('permission_rules')
    .select('*')
    .eq('active', true)
  if (error || !data) {
    cache = { rules: [], fetchedAt: now }
    return []
  }
  cache = { rules: data as PermissionRuleRow[], fetchedAt: now }
  return cache.rules
}

export interface PermissionContext {
  staff: StaffProfileRow | null
}

export async function hasPermission(
  scope: string,
  action: PermissionAction,
  ctx: PermissionContext
): Promise<boolean> {
  // No staff profile: treat as customer, never allow admin scopes
  if (!ctx.staff) return false

  // Super‑simple default: admins can do everything unless an explicit deny system is added
  if (ctx.staff.role === 'admin') return true

  const rules = await loadRules()
  const role = ctx.staff.role
  const userId = ctx.staff.user_id

  // No rules: default allow (backward compat; add rules to restrict)
  if (rules.length === 0) return true

  // Allow-only evaluation:
  // - Scope + action must match
  // - A rule matches if either:
  //   - user_id is set and equals the current staff user_id, OR
  //   - role is set and equals the current staff role
  // Future: conditions JSON evaluation hook goes here.
  const matched = rules.some((r) => {
    if (!r.active) return false
    if (r.scope !== scope) return false
    if (r.action !== action) return false

    const roleMatches = r.role != null ? r.role === role : true
    const userMatches = r.user_id != null ? r.user_id === userId : true

    // If a rule targets a specific user, userMatches must be true.
    // If it targets a role (role != null), roleMatches must be true.
    // If both are present, both must match.
    if (!((r.user_id == null || userMatches) && (r.role == null || roleMatches) && (r.user_id != null || r.role != null))) {
      return false
    }
    return conditionsPass(r.conditions, ctx)
  })

  // If there is no explicit rule match for this scope/action, use built-in defaults.
  if (!matched) return staffDefaultAllows(scope, action)
  return true
}

