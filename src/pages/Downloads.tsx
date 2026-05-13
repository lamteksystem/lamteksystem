import { useEffect, useState } from 'react'
import { PageNav } from '@/components/PageNav'
import { supabase } from '@/lib/supabase'
import { getDocumentUrls } from '@/lib/documents'
import type { DocumentRow } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
  brochure: 'Brochures',
  technical: 'Technical data',
  pricelist: 'Price lists',
  other: 'Other',
}

export default function Downloads() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .order('category')
        .order('title')
      const list = (data ?? []) as DocumentRow[]
      setDocuments(list)
      const urlMap = await getDocumentUrls(list)
      setDocumentUrls(urlMap)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter
    ? documents.filter((d) => d.category === filter)
    : documents
  const categories = [...new Set(documents.map((d) => d.category))]

  function getFileUrl(row: DocumentRow): string {
    if (documentUrls[row.id]) return documentUrls[row.id]
    if (row.file_path.startsWith('http')) return row.file_path
    return supabase.storage.from('documents').getPublicUrl(row.file_path).data.publicUrl
  }

  return (
    <div className="downloads-page">
      <PageNav backTo="/" backLabel="Dashboard" />
      <h1>Downloads</h1>
      <p className="page-intro">
        View or download price lists, technical information, brochures, and order forms. If you prefer printed materials, contact us.
      </p>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {categories.length > 1 && (
            <div className="downloads-filters">
              <button
                type="button"
                className={filter === '' ? 'btn btn-small active' : 'btn btn-small btn-outline'}
                onClick={() => setFilter('')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={filter === cat ? 'btn btn-small active' : 'btn btn-small btn-outline'}
                  onClick={() => setFilter(cat)}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          )}
          <div className="downloads-list">
            {filtered.length === 0 ? (
              <div className="card">
                <p>No documents are available yet. Lamtek will add the latest brochures, technical sheets, and pricelists here as they are released.</p>
              </div>
            ) : (
              filtered.map((doc) => (
                <div key={doc.id} className="card downloads-item">
                  <div className="downloads-item-main">
                    <span className="downloads-category">{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
                    <h3 className="downloads-title">{doc.title}</h3>
                    {doc.description && <p className="downloads-desc">{doc.description}</p>}
                  </div>
                  <div className="downloads-item-actions">
                    <a
                      href={getFileUrl(doc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                    >
                      View
                    </a>
                    <a
                      href={getFileUrl(doc)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      download
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
