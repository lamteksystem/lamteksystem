import { getUserPreference, setUserPreference } from '@/lib/userPreferences'

/** Staff defaults for customer-facing quote PDFs/prints. */
export interface QuoteDocumentDisplayOptions {
  hideSku: boolean
  hideUnitPrice: boolean
  hideLineTotals: boolean
  hideVatBreakdown: boolean
  hidePaymentTerms: boolean
  showCombinationGroups: boolean
}

export const DEFAULT_QUOTE_DOCUMENT_DISPLAY: QuoteDocumentDisplayOptions = {
  hideSku: false,
  hideUnitPrice: false,
  hideLineTotals: false,
  hideVatBreakdown: false,
  hidePaymentTerms: false,
  showCombinationGroups: true,
}

export const QUOTE_DOCUMENT_PREF_KEY = 'quote_document_display'

export function mergeQuoteDocumentDisplay(
  partial?: Partial<QuoteDocumentDisplayOptions> | null,
): QuoteDocumentDisplayOptions {
  return { ...DEFAULT_QUOTE_DOCUMENT_DISPLAY, ...partial }
}

export async function loadQuoteDocumentDisplayPrefs(): Promise<QuoteDocumentDisplayOptions> {
  const raw = await getUserPreference(QUOTE_DOCUMENT_PREF_KEY)
  if (!raw) return { ...DEFAULT_QUOTE_DOCUMENT_DISPLAY }
  try {
    return mergeQuoteDocumentDisplay(JSON.parse(raw) as Partial<QuoteDocumentDisplayOptions>)
  } catch {
    return { ...DEFAULT_QUOTE_DOCUMENT_DISPLAY }
  }
}

export async function saveQuoteDocumentDisplayPrefs(opts: QuoteDocumentDisplayOptions): Promise<void> {
  await setUserPreference(QUOTE_DOCUMENT_PREF_KEY, JSON.stringify(opts))
}

/** Parse display flags from quote print URL (?hideSku=1 etc.). */
export function quoteDisplayFromSearchParams(params: URLSearchParams): Partial<QuoteDocumentDisplayOptions> {
  const flag = (key: string) => params.get(key) === '1' || params.get(key) === 'true'
  const out: Partial<QuoteDocumentDisplayOptions> = {}
  if (params.has('hideSku')) out.hideSku = flag('hideSku')
  if (params.has('hideUnitPrice')) out.hideUnitPrice = flag('hideUnitPrice')
  if (params.has('hideLineTotals')) out.hideLineTotals = flag('hideLineTotals')
  if (params.has('hideVat')) out.hideVatBreakdown = flag('hideVat')
  if (params.has('hidePaymentTerms')) out.hidePaymentTerms = flag('hidePaymentTerms')
  if (params.has('hideCombinations')) out.showCombinationGroups = !flag('hideCombinations')
  return out
}

export function quoteDisplayToSearchParams(opts: QuoteDocumentDisplayOptions): string {
  const p = new URLSearchParams()
  if (opts.hideSku) p.set('hideSku', '1')
  if (opts.hideUnitPrice) p.set('hideUnitPrice', '1')
  if (opts.hideLineTotals) p.set('hideLineTotals', '1')
  if (opts.hideVatBreakdown) p.set('hideVat', '1')
  if (opts.hidePaymentTerms) p.set('hidePaymentTerms', '1')
  if (!opts.showCombinationGroups) p.set('hideCombinations', '1')
  return p.toString()
}
