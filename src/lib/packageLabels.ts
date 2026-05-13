import { supabase } from '@/lib/supabase'

function randomSuffix(): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 5; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

async function allocateUniquePackageCode(orderId: string): Promise<string> {
  const prefix = `LAM-${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${prefix}-${randomSuffix()}`
    const { data, error } = await supabase.from('package_labels').select('id').eq('package_code', code).maybeSingle()
    if (error) throw new Error(error.message || 'Could not check package code.')
    if (!data) return code
  }
  throw new Error('Could not allocate a unique package code.')
}

export async function createPackageLabelForPickList(params: {
  pickListId: string
  orderId: string
}): Promise<{ id: string; package_code: string }> {
  const package_code = await allocateUniquePackageCode(params.orderId)
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('package_labels')
    .insert({
      package_code,
      pick_list_id: params.pickListId,
      order_id: params.orderId,
      printed: false,
      scanned: false,
      updated_at: now,
    })
    .select('id, package_code')
    .single()
  if (error || !data) throw new Error(error?.message || 'Could not create package label.')
  return { id: data.id, package_code: data.package_code }
}

export async function markPackageLabelPrinted(labelId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('package_labels')
    .update({ printed: true, printed_at: now, updated_at: now })
    .eq('id', labelId)
  if (error) throw new Error(error.message || 'Could not mark label printed.')
}

export async function markPackageLabelScannedByCode(rawCode: string): Promise<{ id: string; package_code: string }> {
  const package_code = rawCode.trim().toUpperCase()
  if (!package_code) throw new Error('Enter a package code.')

  const { data: row, error: findErr } = await supabase
    .from('package_labels')
    .select('id, package_code, scanned')
    .eq('package_code', package_code)
    .maybeSingle()

  if (findErr) throw new Error(findErr.message || 'Lookup failed.')
  if (!row) throw new Error('No label matches that code.')

  if (row.scanned) {
    return { id: row.id, package_code: row.package_code }
  }

  const now = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('package_labels')
    .update({ scanned: true, scanned_at: now, updated_at: now })
    .eq('id', row.id)
  if (updErr) throw new Error(updErr.message || 'Could not mark scanned.')

  return { id: row.id, package_code: row.package_code }
}
