import { describe, expect, it } from 'vitest'
import { matchImageRowsToProducts, parseImageMappingCsv } from '@/lib/catalogue-import-export'

describe('parseImageMappingCsv', () => {
  it('parses CSV rows with headers', async () => {
    const csv = [
      'sku,product_name,path,image_url',
      'ABC-1,Shaker Door,/doors/shaker,https://example.com/a.jpg',
      ',Handle,,https://example.com/h.jpg',
    ].join('\n')
    const file = new File([csv], 'images.csv', { type: 'text/csv' })
    const rows = await parseImageMappingCsv(file)
    expect(rows.length).toBe(2)
    expect(rows[0].sku).toBe('ABC-1')
    expect(rows[0].image_url).toBe('https://example.com/a.jpg')
    expect(rows[1].product_name).toBe('Handle')
  })
})

describe('matchImageRowsToProducts', () => {
  it('matches exact SKU first', () => {
    const products = [
      { id: 'p1', sku: 'ABC-1', name: 'Shaker Door', description: null } as any,
      { id: 'p2', sku: 'XYZ-9', name: 'Other', description: null } as any,
    ]
    const rows = [
      { sku: 'ABC-1', product_name: undefined, path: undefined, image_url: 'https://x/a.jpg' },
    ] as any
    const res = matchImageRowsToProducts(products, rows, 0.8)
    expect(res[0].status).toBe('matched')
    expect(res[0].products[0].id).toBe('p1')
  })

  it('matches by name/path with threshold', () => {
    const products = [
      { id: 'p1', sku: null, name: 'Shaker Door 600mm', description: 'Door' } as any,
      { id: 'p2', sku: null, name: 'Knob Handle', description: 'Handle' } as any,
    ]
    const rows = [
      { sku: undefined, product_name: 'Shaker Door', path: '/doors/shaker', image_url: 'https://x/a.jpg' },
    ] as any
    const res = matchImageRowsToProducts(products, rows, 0.4)
    expect(res[0].status).toBe('matched')
    expect(res[0].products[0].id).toBe('p1')
  })
})

