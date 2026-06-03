/**
 * User-facing labels for complete-unit component lists.
 * Code keeps `workbench_bom` / BOM internally; UI prefers kitchen-trade friendly "unit kit".
 */
export const KIT_LABEL = 'Unit kit'
export const KIT_LABEL_SHORT = 'Kit'
export const KIT_COLUMN_LABEL = 'Kit'
export const KIT_TOOLTIP =
  'Parts that make up this sellable complete unit (carcass, door, hinges, etc.). Same as a bill of materials (BOM) in manufacturing systems.'

export function kitComputeLabel(scope: 'selected' | 'all'): string {
  return scope === 'all' ? 'Compute unit kits (all completes)' : 'Compute unit kits (selected)'
}
