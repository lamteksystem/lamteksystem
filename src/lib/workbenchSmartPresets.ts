/**
 * Curated smart-control presets: taxonomy rules + unit-kit (BOM) workflows.
 */
import { hasWorkbenchBom } from '@/lib/workbenchBom'
import type { PricelistWorkbenchRow } from '@/lib/pricelistWorkbench'
import type { WorkbenchRule } from '@/lib/pricelistWorkbenchRules'
import { filterRowsByRule, simulateRuleOnRows } from '@/lib/pricelistWorkbenchRules'
import type { CategoryRow } from '@/types/database'

export type SmartPresetCategory = 'taxonomy' | 'kit' | 'cleanup'

export type SmartPresetKind = 'rule' | 'kit_action'

export type KitActionId =
  | 'compute_kits_selected'
  | 'compute_kits_all'
  | 'infer_part_types'
  | 'title_case_names'
  | 'bulk_assign_panels'

export type SmartPreset =
  | {
      id: string
      kind: 'rule'
      category: SmartPresetCategory
      title: string
      description: string
      rule: WorkbenchRule
      /** Suggested natural-language command for the AI box. */
      promptHint?: string
    }
  | {
      id: string
      kind: 'kit_action'
      category: SmartPresetCategory
      title: string
      description: string
      action: KitActionId
    }

export const WORKBENCH_SMART_PRESETS: SmartPreset[] = [
  {
    id: 'preset-panels-taxonomy',
    kind: 'rule',
    category: 'taxonomy',
    title: 'Assign Panels + accessory',
    description: 'End panels and similar trim → Panels category, sold as accessory.',
    promptHint: 'Assign category Panels and kind accessory to all rows whose name contains "panel"',
    rule: {
      id: 'preset-panels-taxonomy',
      name: 'Panels — category + accessory',
      matchMode: 'all',
      conditions: [{ field: 'name', op: 'contains', value: 'panel' }],
      action: 'assign_taxonomy',
      actionParam: 'category=Panels;kind=accessory',
    },
  },
  {
    id: 'preset-unassigned-tealbury',
    kind: 'rule',
    category: 'taxonomy',
    title: 'Select unassigned Tealbury',
    description: 'Tick rows with no category so you can bulk-edit or smart-assign.',
    rule: {
      id: 'preset-unassigned-tealbury',
      name: 'Select unassigned Tealbury',
      matchMode: 'all',
      conditions: [
        { field: 'source', op: 'equals', value: 'tealbury' },
        { field: 'category', op: 'unassigned', value: '' },
      ],
      action: 'select',
    },
  },
  {
    id: 'preset-completes-no-kit-select',
    kind: 'rule',
    category: 'kit',
    title: 'Select completes missing unit kit',
    description: 'Tealbury complete units with no kit breakdown computed yet.',
    rule: {
      id: 'preset-completes-no-kit-select',
      name: 'Select completes — kit missing',
      matchMode: 'all',
      conditions: [
        { field: 'source', op: 'equals', value: 'tealbury' },
        { field: 'item_kind', op: 'equals', value: 'complete' },
        { field: 'kit', op: 'equals', value: 'missing' },
      ],
      action: 'select',
    },
  },
  {
    id: 'preset-no-doors-select',
    kind: 'rule',
    category: 'kit',
    title: 'Select “No Doors” completes',
    description: 'These cannot get UFORM doors — review before publish or delete.',
    rule: {
      id: 'preset-no-doors-select',
      name: 'Select No Doors completes',
      matchMode: 'all',
      conditions: [
        { field: 'source', op: 'equals', value: 'tealbury' },
        { field: 'item_kind', op: 'equals', value: 'complete' },
        { field: 'door_range', op: 'contains', value: 'No Doors' },
      ],
      action: 'select',
    },
  },
  {
    id: 'preset-no-doors-delete',
    kind: 'rule',
    category: 'cleanup',
    title: 'Remove “No Doors” completes',
    description: 'Deletes Tealbury rows on the No Doors range from the draft (not live catalogue).',
    rule: {
      id: 'preset-no-doors-delete',
      name: 'Delete Tealbury — No Doors range',
      matchMode: 'all',
      conditions: [
        { field: 'source', op: 'equals', value: 'tealbury' },
        { field: 'door_range', op: 'contains', value: 'No Doors' },
      ],
      action: 'delete',
    },
  },
  {
    id: 'preset-accessory-as-complete-select',
    kind: 'rule',
    category: 'taxonomy',
    title: 'Select panels marked as complete',
    description: 'Panel/trim rows still sold-as complete — fix with Infer or Panels preset.',
    rule: {
      id: 'preset-accessory-as-complete-select',
      name: 'Select panel-like completes',
      matchMode: 'all',
      conditions: [
        { field: 'source', op: 'equals', value: 'tealbury' },
        { field: 'item_kind', op: 'equals', value: 'complete' },
        { field: 'name', op: 'contains', value: 'panel' },
      ],
      action: 'select',
    },
  },
  {
    id: 'preset-title-case',
    kind: 'rule',
    category: 'cleanup',
    title: 'Title Case all names',
    description: 'Major words capitalized; minor words (and, for, in) stay lowercase.',
    rule: {
      id: 'preset-title-case',
      name: 'Title Case — names',
      matchMode: 'all',
      conditions: [{ field: 'name', op: 'not_empty', value: '' }],
      action: 'change_text_case',
      actionParam: 'name:title',
    },
  },
  {
    id: 'kit-compute-all',
    kind: 'kit_action',
    category: 'kit',
    title: 'Compute unit kits (all completes)',
    description: 'Build kit breakdown on every Tealbury complete using Lamtek + UFORM rows in this draft.',
    action: 'compute_kits_all',
  },
  {
    id: 'kit-compute-selected',
    kind: 'kit_action',
    category: 'kit',
    title: 'Compute unit kits (selected)',
    description: 'Build kit breakdown on ticked Tealbury complete rows only.',
    action: 'compute_kits_selected',
  },
  {
    id: 'kit-infer',
    kind: 'kit_action',
    category: 'taxonomy',
    title: 'Infer part types (all rows)',
    description: 'Re-guess sold-as (complete vs accessory) and component part types from section/name.',
    action: 'infer_part_types',
  },
  {
    id: 'kit-panels-bulk',
    kind: 'kit_action',
    category: 'taxonomy',
    title: 'Bulk assign Panels',
    description: 'Panels category + accessory on panel-like Tealbury/UFORM rows.',
    action: 'bulk_assign_panels',
  },
]

export type KitActionPreview = {
  action: KitActionId
  title: string
  summary: string
  affected: number
  ok?: number
  failed?: number
  samples: { label: string; detail: string }[]
  warnings: string[]
  canApply: boolean
}

export function previewKitAction(
  action: KitActionId,
  rows: PricelistWorkbenchRow[],
  scopeRows: PricelistWorkbenchRow[],
  categories: CategoryRow[],
): KitActionPreview {
  const panelsCat = categories.find((c) => c.name.toLowerCase() === 'panels' || c.slug === 'panels')
  const completes = scopeRows.filter((r) => r.source === 'tealbury' && r.item_kind === 'complete')
  const selectedCompletes = completes.filter((r) => r.selected)

  switch (action) {
    case 'compute_kits_all': {
      const n = completes.length
      const withKit = completes.filter((r) => hasWorkbenchBom(r)).length
      return {
        action,
        title: 'Compute unit kits (all completes)',
        summary: `Will recompute kits on ${n} Tealbury complete(s). ${withKit} already have a kit (will refresh).`,
        affected: n,
        samples: completes.slice(0, 4).map((r) => ({
          label: r.trade_code || r.sku,
          detail: `${r.door_range || '—'} · kit ${hasWorkbenchBom(r) ? 'present' : 'missing'}`,
        })),
        warnings: n === 0 ? ['No Tealbury complete units in scope.'] : [],
        canApply: n > 0,
      }
    }
    case 'compute_kits_selected': {
      const n = selectedCompletes.length
      return {
        action,
        title: 'Compute unit kits (selected)',
        summary: n ? `Will compute kits on ${n} selected complete(s).` : 'Select Tealbury complete rows first.',
        affected: n,
        samples: selectedCompletes.slice(0, 4).map((r) => ({
          label: r.trade_code || r.sku,
          detail: r.name.slice(0, 48),
        })),
        warnings: n === 0 ? ['Tick one or more Tealbury complete rows in the table.'] : [],
        canApply: n > 0,
      }
    }
    case 'infer_part_types':
      return {
        action,
        title: 'Infer part types',
        summary: `Will re-infer sold-as and part types on ${scopeRows.length} row(s) in scope.`,
        affected: scopeRows.length,
        samples: scopeRows.slice(0, 4).map((r) => ({
          label: r.sku,
          detail: `now: ${r.item_kind}${r.part_type ? ` / ${r.part_type}` : ''}`,
        })),
        warnings: [],
        canApply: scopeRows.length > 0,
      }
    case 'title_case_names':
      return {
        action,
        title: 'Title Case names',
        summary: `Will Title Case names on ${rows.filter((r) => r.name?.trim()).length} row(s).`,
        affected: rows.filter((r) => r.name?.trim()).length,
        samples: rows.slice(0, 3).map((r) => ({ label: r.sku, detail: r.name })),
        warnings: [],
        canApply: rows.length > 0,
      }
    case 'bulk_assign_panels': {
      const panelLike = scopeRows.filter(
        (r) =>
          (r.source === 'tealbury' || r.source === 'uform') &&
          /\b(end\s*)?panel\b/i.test(`${r.name} ${r.section}`),
      )
      const needs = panelLike.filter(
        (r) => r.item_kind !== 'accessory' || r.category_id !== panelsCat?.id,
      )
      return {
        action,
        title: 'Bulk assign Panels',
        summary: panelsCat
          ? `${needs.length} panel-like row(s) would be updated to Panels + accessory.`
          : 'Create a Panels category first.',
        affected: needs.length,
        samples: needs.slice(0, 4).map((r) => ({
          label: r.name.slice(0, 40),
          detail: `${r.category_name || 'unassigned'} · ${r.item_kind}`,
        })),
        warnings: !panelsCat ? ['No “Panels” category found.'] : [],
        canApply: !!panelsCat && needs.length > 0,
      }
    }
    default:
      return {
        action,
        title: action,
        summary: 'Unknown action',
        affected: 0,
        samples: [],
        warnings: [],
        canApply: false,
      }
  }
}

export function previewRulePreset(
  preset: Extract<SmartPreset, { kind: 'rule' }>,
  rows: PricelistWorkbenchRow[],
  scopeRows: PricelistWorkbenchRow[],
  categories: CategoryRow[],
  targetIds?: Set<string>,
) {
  const poolIds = targetIds ?? new Set(scopeRows.map((r) => r.id))
  return simulateRuleOnRows(rows, preset.rule, poolIds, categories)
}

export function matchedRowsForPreset(
  preset: Extract<SmartPreset, { kind: 'rule' }>,
  scopeRows: PricelistWorkbenchRow[],
): PricelistWorkbenchRow[] {
  return filterRowsByRule(scopeRows, preset.rule)
}
