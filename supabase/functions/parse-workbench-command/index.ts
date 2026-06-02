// Turns a plain-English pricelist-workbench command into a structured rule using
// Google Gemini (free tier). Staff-only. If GEMINI_API_KEY is not set, returns 503
// so the frontend silently falls back to its offline parser.
//
// Secret required (Supabase → Edge Functions → Secrets):  GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// gemini-2.5-flash is on the project's free tier (2.0-flash returns limit:0 here).
const MODEL = 'gemini-2.5-flash'

const FIELD_ENUM = [
  'source',
  'door_range',
  'section',
  'sku',
  'name',
  'category_name',
  'description',
  'cost_price',
  'unit_price',
  'category',
]
const OP_ENUM = [
  'contains',
  'equals',
  'not_contains',
  'starts_with',
  'greater_than',
  'less_than',
  'sku_appears_in_name',
  'empty',
  'not_empty',
  'unassigned',
]
const ACTION_ENUM = [
  'delete',
  'remove_sku_from_name',
  'strip_text_from_field',
  'change_text_case',
  'select',
  'deselect',
  'set_active',
  'set_inactive',
  'assign_category',
  'assign_taxonomy',
]

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    matchMode: { type: 'STRING', enum: ['all', 'any'] },
    action: { type: 'STRING', enum: ACTION_ENUM },
    actionParam: { type: 'STRING' },
    conditions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          field: { type: 'STRING', enum: FIELD_ENUM },
          op: { type: 'STRING', enum: OP_ENUM },
          value: { type: 'STRING' },
        },
        required: ['field', 'op', 'value'],
      },
    },
  },
  required: ['matchMode', 'action', 'conditions'],
}

function systemPrompt(categories: string[], sections: string[], doorRanges: string[]): string {
  return `You convert a kitchen-catalogue admin's plain-English instruction into ONE structured rule that filters product rows and applies a single action. Output ONLY JSON matching the provided schema.

ROW FIELDS you can filter on (field enum): source (tealbury|lamtek|uform), door_range, section, sku, name, category_name, description, cost_price, unit_price, category.
CONDITION operators (op enum): contains, equals, not_contains, starts_with, greater_than, less_than (numbers only, for cost_price/unit_price), sku_appears_in_name (value ""), empty, not_empty, unassigned (use with field "category", value "").
matchMode: "all" = every condition must match (AND); "any" = any (OR). Default "all".
If the instruction targets every row (e.g. "all products", "each item"), return an EMPTY conditions array.

ACTIONS (action enum) and how to fill actionParam:
- delete: remove rows from the draft. actionParam "".
- assign_category: assign ONE category. actionParam = the category NAME exactly as in this list if possible: [${categories.join(' | ')}].
- assign_taxonomy: assign SEVERAL of category / section / kind / part type at once (use this whenever the user sets more than one of these, e.g. "categorise to Panels, section Panels, kind component"). actionParam = semicolon-separated "field=value" pairs using fields: category, section, kind, part_type. Multiple values for one field use "|". Match category to the list above when possible. IMPORTANT: "kind" is a FIXED type, only one of: complete, component, door, drawer_front, accessory, other. A grouping word like "Panels", "Doors range", "Trims" is NOT a kind — put those under section or category, and only set kind when the user clearly means one of the fixed types. Example actionParam: category=Panels;section=Panels
- remove_sku_from_name: tidies the SKU/code out of the name. actionParam "".
- strip_text_from_field: remove a literal phrase. actionParam = "field:phrase" where field is description|name|sku. Example: description:Section:
- change_text_case: actionParam = "FIELDS:MODE[:onlycaps]". FIELDS = one or more of name,description,section,door_range,trade_code,sku joined with "+". MODE = sentence|title|upper|lower. Append ":onlycaps" when the user only wants to fix text that is currently in CAPITALS / ALL CAPS (so already-tidy text is left alone). Example: name+description:sentence:onlycaps
- select / deselect: tick or untick rows. actionParam "".
- set_active / set_inactive: enable or disable rows. actionParam "".

KNOWN sections: [${sections.slice(0, 60).join(' | ')}].
KNOWN door ranges: [${doorRanges.slice(0, 60).join(' | ')}].

Rules:
- Pick the single best action. Prefer change_text_case for case/capitalisation requests; strip_text_from_field for "remove the word/phrase X"; assign_category for "categorise/assign/put in"; delete for "remove/delete rows".
- Only add conditions the user clearly asked for. Do not invent filters. A quoted field NAME (e.g. the "Name" field) is NOT a filter value.
- For prices, value must be a plain number string (no £).`
}

interface Body {
  prompt?: string
  categories?: string[]
  sections?: string[]
  doorRanges?: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) return json({ error: 'AI not configured' }, 503)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!supabaseUrl || !supabaseAnonKey || !authHeader) return json({ error: 'Unauthorized' }, 401)

  // Staff-only.
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user: caller },
  } = await supabaseAuth.auth.getUser()
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  const { data: staffRow } = await supabaseAuth
    .from('staff_profiles')
    .select('id')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (!staffRow) return json({ error: 'Staff only' }, 403)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return json({ error: 'Empty prompt' }, 400)

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`
  const payload = {
    systemInstruction: {
      parts: [
        {
          text: systemPrompt(
            body.categories ?? [],
            body.sections ?? [],
            body.doorRanges ?? [],
          ),
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // Disable "thinking" on 2.5-flash for faster, cheaper structured output.
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  let geminiRes: Response
  try {
    geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    return json({ error: `AI request failed: ${e instanceof Error ? e.message : String(e)}` }, 502)
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => '')
    return json({ error: `AI error ${geminiRes.status}`, detail: detail.slice(0, 500) }, 502)
  }

  let data: {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  try {
    data = await geminiRes.json()
  } catch {
    return json({ error: 'AI returned non-JSON' }, 502)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return json({ error: 'AI returned empty result' }, 502)

  let rule: unknown
  try {
    rule = JSON.parse(text)
  } catch {
    return json({ error: 'AI returned malformed rule' }, 502)
  }

  return json({ rule })
})
