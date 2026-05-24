export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface DocumentRow {
  id: string
  created_at: string
  title: string
  description: string | null
  file_path: string
  file_type: string
  category: 'brochure' | 'technical' | 'pricelist' | 'other'
  role?: 'pricelist' | 'main_brochure' | 'door_finder' | null
  is_archived?: boolean
}

export interface MarketingSiteSettingsRow {
  id: string
  carousel_limit: number
  carousel_product_ids: string[]
  updated_at: string
}

/** Category type code — built-ins: product_type, door_range, universal; custom types allowed. */
export type CategoryKind = string

export interface CategoryTypeRow {
  code: string
  label: string
  description: string | null
  sort_order: number
  browse_mode: 'product' | 'door_range' | 'universal'
  active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  sort_order: number
  parent_id: string | null
  category_kind?: CategoryKind
}

export interface ProductCategoryRow {
  product_id: string
  category_id: string
  is_primary: boolean
}

export interface ProductRow {
  id: string
  category_id: string | null
  name: string
  description: string | null
  sku: string | null
  unit_price: number
  cost_price: number | null
  stock_quantity: number
  image_url: string | null
  image_alt: string | null
  options: Json
  active: boolean
  sort_order: number
  created_at: string
  is_stock?: boolean
  /**
   * When set, the product itself IS a single part of this type (panel, plinth, hinge, etc.).
   * NULL means the product is either a complete unit (with an `assemblies` row exploding into
   * component parts) or unclassified. See `supabase/migrations/080_products_part_type.sql`.
   */
  part_type?: string | null
  /** `lamtek` = component catalogue; `tealbury` = curated packaged kitchens programme. */
  catalog_program?: 'lamtek' | 'tealbury'
}

/** Subset returned by `marketing_carousel_products` RPC (public homepage; no pricing/cost/stock). */
export type MarketingCarouselProductRow = Pick<
  ProductRow,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'sku'
  | 'image_url'
  | 'image_alt'
  | 'options'
  | 'active'
  | 'sort_order'
  | 'created_at'
  | 'is_stock'
>

export interface SupplierRow {
  id: string
  user_id: string | null
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LocationRow {
  id: string
  name: string
  code: string | null
  address: string | null
  phone: string | null
  opening_hours: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DeliveryWindowRow {
  id: string
  name: string
  start_time: string
  end_time: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface DeliveryServiceDayRow {
  id: string
  window_id: string
  weekday: number
  cut_off_time: string
  lead_time_days: number
  created_at: string
  updated_at: string
}

export type OrderLinkReason = 'extras' | 'replacement' | 'samples' | 'goodwill' | 'other'

export const ORDER_LINK_REASONS: OrderLinkReason[] = ['extras', 'replacement', 'samples', 'goodwill', 'other']

export interface ProductStockRow {
  product_id: string
  location_id: string
  quantity: number
  updated_at: string
}

export interface ShipmentRow {
  id: string
  order_id: string
  location_id: string | null
  courier: string | null
  tracking: string | null
  shipped_at: string
  note: string | null
  created_at: string
}

export type PickListStatus = 'generated' | 'picking' | 'picked' | 'cancelled'

export interface PickListRow {
  id: string
  order_id: string
  shipment_id: string | null
  location_id: string | null
  status: PickListStatus
  generated_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface PickListItemRow {
  id: string
  pick_list_id: string
  order_line_id: string | null
  product_id: string | null
  required_qty: number
  picked_qty: number
  created_at: string
  updated_at: string
}

export interface PackageLabelRow {
  id: string
  package_code: string
  pick_list_id: string | null
  order_id: string
  printed: boolean
  scanned: boolean
  printed_at: string | null
  scanned_at: string | null
  created_at: string
  updated_at: string
}

export interface StockMovementRow {
  id: string
  product_id: string
  location_id: string
  order_id: string | null
  quantity_delta: number
  reason: string
  created_at: string
}

export interface AccountTransactionRow {
  id: string
  customer_user_id: string
  type: 'invoice' | 'payment' | 'credit_note' | 'adjustment'
  order_id: string | null
  /** Set when this credit_note was posted from an approved return line. */
  return_line_id?: string | null
  amount: number
  reference: string | null
  note: string | null
  created_by_staff_id: string | null
  created_at: string
  updated_at: string
}

export interface TicketRow {
  id: string
  customer_user_id: string
  order_id: string | null
  type: 'returns' | 'issue' | 'question'
  subject: string
  body: string
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved'
  priority: number
  assigned_staff_id: string | null
  created_at: string
  updated_at: string
}

export interface TicketMessageRow {
  id: string
  ticket_id: string
  author_user_id: string | null
  body: string
  is_internal: boolean
  created_at: string
}

export interface TicketAttachmentRow {
  id: string
  ticket_id: string
  created_by_user_id: string | null
  file_path: string
  file_name: string | null
  file_type: string | null
  is_internal: boolean
  created_at: string
}

export interface ReturnLineRow {
  id: string
  ticket_id: string
  order_line_id: string | null
  product_id: string | null
  quantity: number
  reason: string | null
  resolution: string | null
  created_at: string
  updated_at: string
}

export interface OrderRow {
  id: string
  user_id: string
  status: 'draft' | 'quotation' | 'placed' | 'invoiced' | 'paid' | 'cancelled'
  is_archived?: boolean
  total_ex_vat: number
  total_inc_vat: number
  reference: string | null
  created_at: string
  updated_at: string
  delivery_address?: string | null
  delivery_postcode?: string | null
  delivery_notes?: string | null
  delivery_contact_name?: string | null
  delivery_contact_phone?: string | null
  delivery_contact_email?: string | null
  delivery_contact_notes?: string | null
  delivery_same_as_billing?: boolean
  processed_at?: string | null
  delivery_tracking?: string | null
  created_by_staff_id?: string | null
  payment_intent_id?: string | null
  payment_status?: 'pending' | 'succeeded' | 'failed' | 'refunded' | null
  invoice_number?: string | null
  courier?: string | null
  delivery_expected_date?: string | null
  /** `delivery` or depot click & collect */
  fulfillment_method?: 'delivery' | 'collect'
  collection_location_id?: string | null
  collection_ready_at?: string | null
  collection_must_collect_by?: string | null
  collection_notes?: string | null
  delivery_window_id?: string | null
  /** YYYY-MM-DD */
  delivery_scheduled_date?: string | null
  parent_order_id?: string | null
  link_reason?: OrderLinkReason | null
  courier_service_code?: string | null
  courier_service_add_ons?: string[] | null
  courier_preferred_time_slot?: string | null
  courier_preferred_date?: string | null
  /** Door range chosen by the order-start wizard (FK to a category with category_kind='door_range'). */
  kitchen_range_id?: string | null
  /** Selected door finish of the chosen range (e.g. "Soft Matte"). Free text, matches a finish key in product options. */
  door_finish?: string | null
  /** Selected carcass/cabinet finish (e.g. "White", "Light Oak", "Grey"). Free text for now. */
  carcass_finish?: string | null
}

export const COURIER_OPTIONS = ['DPD', 'FedEx', 'Royal Mail', 'Yodel', 'Evri', 'Parcelforce', 'DX', 'Other'] as const

export interface StaffProfileRow {
  id: string
  user_id: string
  role: 'admin' | 'staff'
  display_name: string | null
  department?: string | null
  phone?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface PermissionRuleRow {
  id: string
  name: string
  description: string | null
  scope: string
  action: string
  role: 'admin' | 'staff' | null
  user_id: string | null
  conditions: Json
  active: boolean
  created_at: string
  updated_at: string
}

export interface OrderLineRow {
  id: string
  order_id: string
  product_id: string
  product_snapshot: Json
  quantity: number
  unit_price: number
  options: Json
  created_at?: string
}

export interface OrderEventRow {
  id: string
  order_id: string
  actor_user_id: string | null
  event_type: string
  from_status: string | null
  to_status: string | null
  note: string | null
  created_at: string
}

export interface UserNotificationRow {
  id: string
  user_id: string
  order_id: string | null
  title: string
  body: string | null
  link: string | null
  channel: 'portal' | 'email' | 'sms'
  sent_at: string | null
  read_at: string | null
  created_at: string
}

export interface OpportunityRow {
  id: string
  customer_user_id: string
  name: string
  stage: string
  value_ex_vat: number
  expected_close_date: string | null
  owner_staff_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ActivityRow {
  id: string
  customer_user_id: string
  activity_type: string
  subject: string | null
  body: string | null
  due_at: string | null
  completed_at: string | null
  author_user_id: string | null
  opportunity_id: string | null
  created_at: string
  updated_at: string
}

export interface CustomerProfileRow {
  id: string
  user_id: string
  customer_ref?: string | null
  company_name: string
  contact_name: string | null
  balance_outstanding: number
  updated_at: string
  payment_terms?: string | null
  customer_group_id?: string | null
  customer_location_id?: string | null
  trade_type_id?: string | null
  company_type_id?: string | null
  /** Extra % off resolved sell price after segment rules (0–100); null = none. */
  account_discount_percent?: number | null
  phone?: string | null
  email_override?: string | null
  website?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_postcode?: string | null
  delivery_address?: string | null
  delivery_city?: string | null
  delivery_postcode?: string | null
  credit_limit?: number | null
  company_notes?: string | null
  employee_count?: number | null
  /** Customer accepted staff acting on their behalf in the portal (view-as). */
  staff_portal_access_consent_at?: string | null
  staff_portal_access_consent_version?: string | null
}

export interface CustomerDeliveryAddressRow {
  id: string
  customer_user_id: string
  label: string
  address: string
  postcode: string | null
  notes: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/** Admin-configurable matrix for outbound / in-app notifications by event type. */
export interface NotificationRuleSettingsRow {
  event_key: string
  label: string
  description: string | null
  email_customer: boolean
  portal_customer: boolean
  sms_customer: boolean
  staff_portal_alert: boolean
  updated_at: string
}

// Pricing & cost control segment lookups
export interface CustomerGroupRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CustomerLocationRow {
  id: string
  name: string
  slug: string
  code: string | null
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TradeTypeRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CompanyTypeRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CollectionRow {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CollectionProductRow {
  collection_id: string
  product_id: string
  sort_order: number
}

export type CustomerPriceRuleScopeType = 'all' | 'category' | 'product' | 'collection'
export type CustomerPriceRuleType = 'percentage_discount' | 'percentage_markup' | 'fixed_price_override'

export interface CustomerPriceRuleRow {
  id: string
  name: string
  description: string | null
  customer_group_id: string | null
  customer_location_id: string | null
  trade_type_id: string | null
  company_type_id: string | null
  scope_type: CustomerPriceRuleScopeType
  scope_category_id: string | null
  scope_product_id: string | null
  scope_collection_id: string | null
  rule_type: CustomerPriceRuleType
  value: number
  min_order_total_ex_vat: number | null
  valid_from: string | null
  valid_to: string | null
  priority: number
  active: boolean
  created_at: string
  updated_at: string
}

export type CostPriceRuleScopeType = 'all' | 'category' | 'product'
export type CostPriceRuleType = 'fixed_cost' | 'percentage_of_sell' | 'markup_on_cost'

export interface CostPriceRuleRow {
  id: string
  name: string
  description: string | null
  supplier_id: string | null
  scope_type: CostPriceRuleScopeType
  scope_category_id: string | null
  scope_product_id: string | null
  rule_type: CostPriceRuleType
  value: number
  valid_from: string | null
  valid_to: string | null
  priority: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CustomerNoteRow {
  id: string
  customer_user_id: string
  author_user_id: string | null
  body: string
  created_at: string
}

/** @deprecated Use string codes from assembly_part_types; built-ins listed in DEFAULT_ASSEMBLY_PART_TYPES. */
export type AssemblyComponentRole =
  | 'unit'
  | 'door'
  | 'drawer'
  | 'hinge'
  | 'hinge_plate'
  | 'leg_kit'
  | 'fittings'
  | 'other'

export interface AssemblyPartTypeRow {
  code: string
  label: string
  sort_order: number
  active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface AssemblyRow {
  id: string
  name: string
  description: string | null
  image_url: string | null
  unit_type: 'base_unit' | 'wall_unit' | 'tall_unit' | 'other'
  width_mm: number | null
  collection_slug: string | null
  sort_order: number
  active: boolean
  /** Sellable complete product this BOM represents (Tealbury complete unit, etc.). */
  product_id: string | null
  created_at: string
  updated_at: string
}

export interface AssemblyLineRow {
  id: string
  assembly_id: string
  product_id: string
  quantity: number
  sort_order: number
  component_role: string
}

export type AssemblyWithLines = AssemblyRow & {
  assembly_lines: (AssemblyLineRow & { product: ProductRow })[]
}
