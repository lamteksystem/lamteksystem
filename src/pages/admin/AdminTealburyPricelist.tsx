import { Navigate } from 'react-router-dom'

/** @deprecated Tealbury import lives on Catalogue → Import & export. */
export default function AdminTealburyPricelist() {
  return <Navigate to="/admin/catalogue?tab=import" replace />
}
