import { lazy, Suspense, useEffect, useState } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { Sidebar } from './components/common/Sidebar.jsx'
import { Navbar } from './components/common/Navbar.jsx'
import { Icon } from './components/common/Icon.jsx'
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then((module) => ({ default: module.DashboardPage })))
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx').then((module) => ({ default: module.ServicesPage })))
const HiringPage = lazy(() => import('./pages/HiringPage.jsx').then((module) => ({ default: module.HiringPage })))
const ExploreListings = lazy(() => import('./pages/ListingsPage.jsx').then((module) => ({ default: module.ExploreListings })))
const ListingsPage = lazy(() => import('./pages/ListingsPage.jsx').then((module) => ({ default: module.ListingsPage })))
const MartPage = lazy(() => import('./pages/MartPage.jsx').then((module) => ({ default: module.MartPage })))
const TradePage = lazy(() => import('./pages/TradePage.jsx').then((module) => ({ default: module.TradePage })))
const ChatPage = lazy(() => import('./pages/ChatPage.jsx').then((module) => ({ default: module.ChatPage })))
const HelpPage = lazy(() => import('./pages/HelpPage.jsx').then((module) => ({ default: module.HelpPage })))

const pages = { overview: DashboardPage, services: ServicesPage, hiring: HiringPage, explore: ExploreListings, listings: ListingsPage, mart: MartPage, chat: ChatPage, trade: TradePage, help: HelpPage }
const pageFromPath = () => {
  const page = window.location.pathname.replace(/^\/+|\/+$/g, '')
  return Object.hasOwn(pages, page) ? page : 'overview'
}
const chatTargetFromUrl = () => {
  const search = new URLSearchParams(window.location.search)
  if (search.has('conversation')) return { conversation: search.get('conversation') }
  if (search.has('context') && search.has('id')) return { context: search.get('context'), id: search.get('id') }
  return null
}

function PageContent({ Page, onNavigate, initialSection, chatTarget }) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => AOS.refreshHard())
    return () => cancelAnimationFrame(frame)
  }, [Page])
  return <Page onNavigate={onNavigate} initialSection={initialSection} chatTarget={chatTarget}/>
}

export default function App() {
  const [activePage, setActivePage] = useState(pageFromPath)
  const [locationKey, setLocationKey] = useState(() => window.location.pathname + window.location.search)
  const [listingSection, setListingSection] = useState('services')
  const [chatTarget, setChatTarget] = useState(chatTargetFromUrl)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900)
  const Page = pages[activePage]

  useEffect(() => {
    AOS.init({ duration: 550, easing: 'ease-out-cubic', once: true, offset: 32, disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches })
  }, [])

  useEffect(() => {
    const restorePage = () => { setActivePage(pageFromPath()); setChatTarget(chatTargetFromUrl()); setLocationKey(window.location.pathname + window.location.search) }
    window.addEventListener('popstate', restorePage)
    return () => window.removeEventListener('popstate', restorePage)
  }, [])

  function navigate(page, detail) {
    if (!Object.hasOwn(pages, page)) return
    if (page === 'listings' && typeof detail === 'string') setListingSection(detail)
    if (page === 'chat') setChatTarget(detail || null)
    setActivePage(page)
    const pathname = page === 'overview' ? '/' : `/${page}`
    const query = (page === 'chat' && detail) || (page === 'explore' && detail?.listing && detail?.id)
      ? `?${new URLSearchParams(detail)}`
      : new URLSearchParams(window.location.search).has('token') ? window.location.search : ''
    if (window.location.pathname + window.location.search !== pathname + query) window.history.pushState({}, '', pathname + query)
    setLocationKey(pathname + query)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className={`app-layout${sidebarOpen ? '' : ' sidebar-collapsed'}`}><Sidebar activePage={activePage} onNavigate={(...args) => { navigate(...args); if (window.innerWidth <= 900) setSidebarOpen(false) }} open={sidebarOpen}/>{sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}<button type="button" className="sidebar-edge-toggle" aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((value) => !value)}><Icon name="chevron" size={18} className={sidebarOpen ? 'sidebar-edge-chevron-open' : ''}/></button><div className="app-main"><Navbar/><main className="page-content"><Suspense fallback={<div className="service-loading" role="status">Loading page...</div>}><PageContent key={activePage === 'chat' ? JSON.stringify(chatTarget) : activePage === 'explore' ? locationKey : activePage} Page={Page} onNavigate={navigate} initialSection={listingSection} chatTarget={chatTarget}/></Suspense></main><footer className="site-footer"><div className="site-footer-brand"><strong>jobNshop</strong><span>Work, shop, and connect in one place.</span></div><nav aria-label="Footer navigation"><button type="button" onClick={() => navigate('explore')}>Marketplace</button><button type="button" onClick={() => navigate('services')}>Services</button><button type="button" onClick={() => navigate('hiring')}>Jobs</button><button type="button" onClick={() => navigate('help')}>Help</button></nav></footer></div></div>
}
