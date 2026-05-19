import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import Layout from '@/components/Layout'
import AdminLayout from '@/components/AdminLayout'
import MtoLayout from '@/components/MtoLayout'
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Downloads from '@/pages/Downloads'
import Ordering from '@/pages/Ordering'
import OrderingStart from '@/pages/OrderingStart'
import TealburyOrdering from '@/pages/TealburyOrdering'
import OrderCart from '@/pages/OrderCart'
import OrderBaskets from '@/pages/OrderBaskets'
import Account from '@/pages/Account'
import OrderDetail from '@/pages/OrderDetail'
import InvoicePrint from '@/pages/InvoicePrint'
import QuotePrint from '@/pages/QuotePrint'
import Products from '@/pages/Products'
import Support from '@/pages/Support'
import SupportTicketDetail from '@/pages/SupportTicketDetail'
import GlobalSearch from '@/pages/GlobalSearch'
import Help from '@/pages/Help'
import MarketingHome from '@/pages/MarketingHome'
import CreateAccount from '@/pages/CreateAccount'
import MarketingAboutPage from '@/pages/MarketingAboutPage'
import MarketingProductsPage from '@/pages/MarketingProductsPage'
import MarketingGalleryPage from '@/pages/MarketingGalleryPage'
import {
  MarketingDepotsDetailPage,
  MarketingDepotsPage,
  MarketingDownloadsPage,
  MarketingLamtekCoUkHubPage,
  MarketingLamtekCompleteCoUkHubPage,
  MarketingManufacturingPage,
  MarketingOrderingPage,
  MarketingTealburyCoUkHubPage,
} from '@/pages/MarketingSections'
import MtoIndex from '@/pages/mto/MtoIndex'
import MtoNonStandard from '@/pages/mto/MtoNonStandard'
import MtoAngled from '@/pages/mto/MtoAngled'
import MtoFramed from '@/pages/mto/MtoFramed'
import MtoWorktopsPanels from '@/pages/mto/MtoWorktopsPanels'
import MtoMouldingsAccessories from '@/pages/mto/MtoMouldingsAccessories'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminCustomers from '@/pages/admin/AdminCustomers'
import AdminOrders from '@/pages/admin/AdminOrders'
import AdminOrderDetail from '@/pages/admin/AdminOrderDetail'
import AdminOrderProcessing from '@/pages/admin/AdminOrderProcessing'
import AdminReminders from '@/pages/admin/AdminReminders'
import AdminInvoicePrint from '@/pages/admin/AdminInvoicePrint'
import AdminQuotePrint from '@/pages/admin/AdminQuotePrint'
import AdminPackingSlipPrint from '@/pages/admin/AdminPackingSlipPrint'
import AdminCreateOrder from '@/pages/admin/AdminCreateOrder'
import AdminCreateQuote from '@/pages/admin/AdminCreateQuote'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminSettings from '@/pages/admin/AdminSettings'
import AdminStaffHelp from '@/pages/admin/AdminStaffHelp'
import AdminCustomerDetail from '@/pages/admin/AdminCustomerDetail'
import AdminCrmLayout from '@/pages/admin/AdminCrmLayout'
import AdminCrmOpenOrders from '@/pages/admin/AdminCrmOpenOrders'
import AdminCrmActivity from '@/pages/admin/AdminCrmActivity'
import AdminCrmPipeline from '@/pages/admin/AdminCrmPipeline'
import AdminCrmDirectory from '@/pages/admin/AdminCrmDirectory'
import AdminNotifications from '@/pages/admin/AdminNotifications'
import AdminCatalogue from '@/pages/admin/AdminCatalogue'
import AdminCatalogueWipe from '@/pages/admin/AdminCatalogueWipe'
import AdminComponentImport from '@/pages/admin/AdminComponentImport'
import AdminVariantBuilder from '@/pages/admin/AdminVariantBuilder'
import AdminDocumentUploads from '@/pages/admin/AdminDocumentUploads'
import AdminCreateUser from '@/pages/admin/AdminCreateUser'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminAccountApplications from '@/pages/admin/AdminAccountApplications'
import AdminPermissions from '@/pages/admin/AdminPermissions'
import AdminStock from '@/pages/admin/AdminStock'
import AdminLocations from '@/pages/admin/AdminLocations'
import AdminDeliveryWindows from '@/pages/admin/AdminDeliveryWindows'
import AdminPricing from '@/pages/admin/AdminPricing'
import AdminTealburyPricelist from '@/pages/admin/AdminTealburyPricelist'
import AdminSmartCategorise from '@/pages/admin/AdminSmartCategorise'
import AdminReports from '@/pages/admin/AdminReports'
import AdminAccounting from '@/pages/admin/AdminAccounting'
import AdminTickets from '@/pages/admin/AdminTickets'
import AdminTicketDetail from '@/pages/admin/AdminTicketDetail'
import AdminPickListDetail from '@/pages/admin/AdminPickListDetail'
import AdminPickLists from '@/pages/admin/AdminPickLists'
import AdminPickListPrint from '@/pages/admin/AdminPickListPrint'
import AdminPackageLabelPrint from '@/pages/admin/AdminPackageLabelPrint'
import Depots from '@/pages/Depots'
import NotFound from '@/pages/NotFound'
import { AdminUiProvider } from '@/contexts/AdminUiContext'

/** Trade portal beneath `/`: full app for logged-in users. Logged-out visitors see marketing home. */
function CustomerPortalRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { loading: staffLoading } = useStaff()

  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (!user) return <MarketingHome />
  return <>{children}</>
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isStaff, loading: staffLoading } = useStaff()
  const [allowRedirect, setAllowRedirect] = useState(false)
  useEffect(() => {
    if (!staffLoading && !isStaff && user) {
      const t = setTimeout(() => setAllowRedirect(true), 800)
      return () => clearTimeout(t)
    }
    setAllowRedirect(false)
  }, [staffLoading, isStaff, user])
  if (loading || staffLoading) return <div className="app-loading">Loading…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isStaff && !allowRedirect) return <div className="app-loading">Checking access…</div>
  if (!isStaff) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/site/products" element={<MarketingProductsPage />} />
      <Route path="/site/ordering" element={<MarketingOrderingPage />} />
      <Route path="/site/downloads" element={<MarketingDownloadsPage />} />
      <Route path="/site/depots" element={<MarketingDepotsPage />} />
      <Route path="/site/about" element={<MarketingAboutPage />} />
      <Route path="/site/gallery" element={<MarketingGalleryPage />} />
      <Route path="/site/manufacturing" element={<MarketingManufacturingPage />} />
      <Route path="/site/depots-details" element={<MarketingDepotsDetailPage />} />
      <Route path="/site/lamtek-uk" element={<MarketingLamtekCoUkHubPage />} />
      <Route path="/site/lamtek-complete-uk" element={<MarketingLamtekCompleteCoUkHubPage />} />
      <Route path="/site/tealbury-uk" element={<MarketingTealburyCoUkHubPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <CustomerPortalRoute>
            <Layout />
          </CustomerPortalRoute>
        }
      >
        <Route path="" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="downloads" element={<Downloads />} />
        <Route path="depots" element={<Depots />} />
        <Route path="ordering/tealbury" element={<TealburyOrdering />} />
        <Route path="ordering" element={<Ordering />} />
        <Route path="ordering/start" element={<OrderingStart />} />
        <Route path="ordering/baskets" element={<OrderBaskets />} />
        <Route path="ordering/cart" element={<OrderCart />} />
        <Route path="ordering/mto" element={<MtoLayout />}>
          <Route index element={<MtoIndex />} />
          <Route path="non-standard" element={<MtoNonStandard />} />
          <Route path="angled" element={<MtoAngled />} />
          <Route path="framed" element={<MtoFramed />} />
          <Route path="worktops-panels" element={<MtoWorktopsPanels />} />
          <Route path="mouldings-accessories" element={<MtoMouldingsAccessories />} />
        </Route>
        <Route path="account" element={<Account />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="search" element={<GlobalSearch />} />
        <Route path="account/orders/:orderId" element={<OrderDetail />} />
        <Route path="account/orders/:orderId/invoice" element={<InvoicePrint />} />
        <Route path="account/orders/:orderId/quote" element={<QuotePrint />} />
        <Route path="account/support" element={<Support />} />
        <Route path="account/support/:ticketId" element={<SupportTicketDetail />} />
        <Route path="account/help" element={<Help />} />
      </Route>
      <Route
        path="/admin"
        element={
          <StaffRoute>
            <AdminUiProvider>
              <AdminLayout />
            </AdminUiProvider>
          </StaffRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="customers/:userId" element={<AdminCustomerDetail />} />
        <Route path="crm" element={<AdminCrmLayout />}>
          <Route index element={<Navigate to="open-orders" replace />} />
          <Route path="open-orders" element={<AdminCrmOpenOrders />} />
          <Route path="activity" element={<AdminCrmActivity />} />
          <Route path="pipeline" element={<AdminCrmPipeline />} />
          <Route path="directory" element={<AdminCrmDirectory />} />
        </Route>
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="catalogue" element={<AdminCatalogue />} />
        <Route path="catalogue/tealbury" element={<AdminTealburyPricelist />} />
        <Route path="catalogue/categories" element={<AdminSmartCategorise />} />
        <Route path="catalogue/wipe" element={<AdminCatalogueWipe />} />
        <Route path="catalogue/components/import" element={<AdminComponentImport />} />
        <Route path="catalogue/components/variant-builder" element={<AdminVariantBuilder />} />
        <Route
          path="catalogue/smart-categorise"
          element={<Navigate to="/admin/catalogue/categories?section=smart" replace />}
        />
        <Route path="stock" element={<AdminStock />} />
        <Route path="locations" element={<AdminLocations />} />
        <Route path="delivery-windows" element={<AdminDeliveryWindows />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/processing" element={<AdminOrderProcessing />} />
        <Route path="orders/reminders" element={<AdminReminders />} />
        <Route path="orders/:orderId/invoice" element={<AdminInvoicePrint />} />
        <Route path="orders/:orderId/packing-slip" element={<AdminPackingSlipPrint />} />
        <Route path="orders/:orderId/quote" element={<AdminQuotePrint />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="pick-lists" element={<AdminPickLists />} />
        <Route path="pick-lists/:pickListId/print" element={<AdminPickListPrint />} />
        <Route path="pick-lists/:pickListId" element={<AdminPickListDetail />} />
        <Route path="package-labels/:labelId/print" element={<AdminPackageLabelPrint />} />
        <Route path="create-order" element={<AdminCreateOrder />} />
        <Route path="create-quote" element={<AdminCreateQuote />} />
        <Route path="uploads" element={<AdminDocumentUploads />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="accounting" element={<AdminAccounting />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="tickets/:ticketId" element={<AdminTicketDetail />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/create" element={<AdminCreateUser />} />
        <Route path="applications" element={<AdminAccountApplications />} />
        <Route path="permissions" element={<AdminPermissions />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="support-manual" element={<AdminStaffHelp />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
