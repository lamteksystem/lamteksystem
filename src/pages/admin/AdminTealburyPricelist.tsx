import { Navigate } from 'react-router-dom'

/** @deprecated Use Pricelist workbench. */
export default function AdminTealburyPricelist() {
  return <Navigate to="/admin/catalogue-tools/pricelist-workbench" replace />
}
