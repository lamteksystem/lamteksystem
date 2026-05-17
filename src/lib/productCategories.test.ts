import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getProductCategoriesFromMap,
  normalizeCategorySelection,
  saveProductCategories,
} from '@/lib/productCategories'

const { rpc, deleteEq, insert, update, selectEq, order } = vi.hoisted(() => ({
  rpc: vi.fn(),
  deleteEq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  selectEq: vi.fn(),
  order: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc,
    from: (table: string) => {
      if (table === 'product_categories') {
        return {
          delete: () => ({ eq: deleteEq }),
          insert,
          select: () => ({
            eq: selectEq.mockReturnValue({ order }),
          }),
        }
      }
      if (table === 'products') {
        return { update }
      }
      return {}
    },
  },
}))

describe('normalizeCategorySelection', () => {
  it('keeps multiple ids and valid primary', () => {
    expect(normalizeCategorySelection(['a', 'b', 'c'], 'b')).toEqual({
      ids: ['a', 'b', 'c'],
      primary: 'b',
    })
  })
})

describe('getProductCategoriesFromMap', () => {
  it('returns null when product is not in the map', () => {
    const map = new Map([['other', ['cat-1', 'cat-2']]])
    expect(getProductCategoriesFromMap('prod-1', 'fallback', map)).toBeNull()
  })

  it('returns junction ids when product is in the map', () => {
    const map = new Map([['prod-1', ['cat-a', 'cat-b']]])
    expect(getProductCategoriesFromMap('prod-1', 'fallback', map)).toEqual({
      categoryIds: ['cat-a', 'cat-b'],
      primaryCategoryId: 'cat-a',
    })
  })
})

describe('saveProductCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ error: null })
    order.mockResolvedValue({
      data: [
        { category_id: 'cat-a', is_primary: false },
        { category_id: 'cat-b', is_primary: true },
      ],
      error: null,
    })
    selectEq.mockReturnValue({ order })
  })

  it('uses RPC and returns categories read back from the database', async () => {
    const result = await saveProductCategories('prod-1', ['cat-a', 'cat-b'], 'cat-b')
    expect(result.error).toBeNull()
    expect(rpc).toHaveBeenCalledWith('save_product_categories', {
      p_product_id: 'prod-1',
      p_category_ids: ['cat-a', 'cat-b'],
      p_primary_category_id: 'cat-b',
    })
    expect(result.categoryIds).toEqual(['cat-a', 'cat-b'])
    expect(result.primaryCategoryId).toBe('cat-b')
  })

  it('reports error when database returns fewer categories than requested', async () => {
    order.mockResolvedValue({
      data: [{ category_id: 'cat-a', is_primary: true }],
      error: null,
    })
    const result = await saveProductCategories('prod-1', ['cat-a', 'cat-b'], 'cat-a')
    expect(result.error).toMatch(/did not persist/)
  })
})
