import { COURIER_OPTIONS } from '@/types/database'

export type CourierName = (typeof COURIER_OPTIONS)[number]

export interface CourierServiceOption {
  code: string
  label: string
  description?: string
}

export interface CourierAddOnOption {
  code: string
  label: string
}

export interface CourierConfig {
  services: CourierServiceOption[]
  addOns: CourierAddOnOption[]
  supportsPreferredDate: boolean
  supportsTimeSlot: boolean
}

export const COURIER_TIME_SLOTS: Array<{ code: string; label: string }> = [
  { code: 'anytime', label: 'Anytime (08:00-18:00)' },
  { code: 'am', label: 'AM (08:00-12:00)' },
  { code: 'pm', label: 'PM (12:00-18:00)' },
  { code: 'evening', label: 'Evening (18:00-21:00)' },
  { code: 'by_1030', label: 'By 10:30' },
  { code: 'by_1200', label: 'By 12:00' },
]

const COMMON_ADD_ONS: CourierAddOnOption[] = [
  { code: 'signature_required', label: 'Signature required' },
  { code: 'safe_place', label: 'Safe place allowed' },
  { code: 'sms_updates', label: 'SMS delivery updates' },
  { code: 'fragile', label: 'Fragile handling' },
]

export const COURIER_SERVICE_CONFIG: Record<string, CourierConfig> = {
  DPD: {
    services: [
      { code: 'dpd_next_day', label: 'Next Day', description: 'Standard next working day service' },
      { code: 'dpd_next_day_1030', label: 'Next Day by 10:30' },
      { code: 'dpd_next_day_1200', label: 'Next Day by 12:00' },
      { code: 'dpd_two_day', label: 'Two Day' },
      { code: 'dpd_saturday', label: 'Saturday Delivery' },
      { code: 'dpd_sunday', label: 'Sunday Delivery' },
    ],
    addOns: [...COMMON_ADD_ONS, { code: 'two_person', label: 'Two-person delivery' }, { code: 'age_verification', label: 'Age verification' }],
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  'Royal Mail': {
    services: [
      { code: 'rm_tracked_24', label: 'Tracked 24' },
      { code: 'rm_tracked_48', label: 'Tracked 48' },
      { code: 'rm_special_1pm', label: 'Special Delivery Guaranteed by 1pm' },
      { code: 'rm_special_9am', label: 'Special Delivery Guaranteed by 9am' },
      { code: 'rm_signedfor_1st', label: '1st Class Signed For' },
      { code: 'rm_signedfor_2nd', label: '2nd Class Signed For' },
    ],
    addOns: [...COMMON_ADD_ONS, { code: 'insurance_enhanced', label: 'Enhanced compensation cover' }],
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  FedEx: {
    services: [
      { code: 'fedex_priority_overnight', label: 'Priority Overnight' },
      { code: 'fedex_standard_overnight', label: 'Standard Overnight' },
      { code: 'fedex_2day', label: '2Day' },
      { code: 'fedex_international_priority', label: 'International Priority' },
    ],
    addOns: [...COMMON_ADD_ONS, { code: 'insurance_enhanced', label: 'Enhanced insurance cover' }],
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  Yodel: {
    services: [
      { code: 'yodel_xpress', label: 'Xpress' },
      { code: 'yodel_xpect', label: 'Xpect' },
      { code: 'yodel_xpert', label: 'Xpert' },
    ],
    addOns: COMMON_ADD_ONS,
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  Evri: {
    services: [
      { code: 'evri_standard_2_4', label: 'Standard 2-4 day' },
      { code: 'evri_next_day', label: 'Next Day' },
      { code: 'evri_parcelshop', label: 'ParcelShop Drop Off' },
    ],
    addOns: COMMON_ADD_ONS,
    supportsPreferredDate: true,
    supportsTimeSlot: false,
  },
  Parcelforce: {
    services: [
      { code: 'pf_express24', label: 'Express24' },
      { code: 'pf_express48', label: 'Express48' },
      { code: 'pf_expressam', label: 'ExpressAM' },
      { code: 'pf_express9', label: 'Express9' },
      { code: 'pf_large', label: 'Large / Heavy Parcel Service' },
    ],
    addOns: [...COMMON_ADD_ONS, { code: 'two_person', label: 'Two-person delivery' }],
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  DX: {
    services: [
      { code: 'dx_secure_next_day', label: 'Secure Next Day' },
      { code: 'dx_freight_next_day', label: 'Freight Next Day' },
    ],
    addOns: [...COMMON_ADD_ONS, { code: 'two_person', label: 'Two-person delivery' }],
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
  Other: {
    services: [{ code: 'other_standard', label: 'Standard service' }],
    addOns: COMMON_ADD_ONS,
    supportsPreferredDate: true,
    supportsTimeSlot: true,
  },
}

export function getCourierConfig(courier: string | null | undefined): CourierConfig {
  return COURIER_SERVICE_CONFIG[courier ?? ''] ?? COURIER_SERVICE_CONFIG.Other
}

export function getCourierServiceLabel(courier: string | null | undefined, code: string | null | undefined): string | null {
  if (!code) return null
  const cfg = getCourierConfig(courier)
  return cfg.services.find((s) => s.code === code)?.label ?? code
}

export function getCourierAddOnLabel(courier: string | null | undefined, code: string): string {
  const cfg = getCourierConfig(courier)
  return cfg.addOns.find((a) => a.code === code)?.label ?? code
}

export function getCourierTimeSlotLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return COURIER_TIME_SLOTS.find((s) => s.code === code)?.label ?? code
}
