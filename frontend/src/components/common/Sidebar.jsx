import { navigation } from '../../config/navigation.js'
import { Icon } from './Icon.jsx'
import { useAuthToken } from '../../redux/Api/auth/AuthApi.js'
import { useGetConversationsQuery } from '../../redux/Api/chat/ChatApi.js'

export function Sidebar({ activePage, onNavigate, open }) {
  const token = useAuthToken()
  const { data } = useGetConversationsQuery(undefined, { skip: !token, pollingInterval: 10000, skipPollingIfUnfocused: true, refetchOnFocus: true })
  const unread = (data?.conversations || []).reduce((total, conversation) => total + (conversation.unreadCount || 0), 0)
  return <aside className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label="Workspace sidebar" inert={!open}>
    <button className="brand" type="button" onClick={() => onNavigate('overview')} aria-label="jobNshop overview">
      <span className="brand-mark">J<span>.</span></span>
      <span>jobNshop</span>
    </button>

    <div className="workspace-card">
      <span className="workspace-avatar">J</span>
      <span className="workspace-card-copy"><strong>My workspace</strong><small>All your activity in one place</small></span>
    </div>

    <div className="sidebar-navigation">
      <p className="nav-label">MENU</p>
      <nav className="side-nav" aria-label="Dashboard navigation">
        {navigation.map(({ id, label, icon }) => <button
          key={id}
          type="button"
          className={`nav-item ${id === 'explore' ? 'nav-item-marketplace' : ''} ${activePage === id ? 'active' : ''}`}
          onClick={() => onNavigate(id)}
          aria-current={activePage === id ? 'page' : undefined}
          aria-label={id === 'chat' && unread ? `${label}, ${unread} unread messages` : undefined}
        ><Icon name={icon} size={20} /><span>{label}</span>{id === 'chat' && unread > 0 && <strong className="sidebar-unread" aria-hidden="true">{unread > 99 ? '99+' : unread}</strong>}<Icon name="chevron" size={15} className="nav-chevron" /></button>)}
      </nav>
    </div>

    <div className="sidebar-bottom">
      <span className="sidebar-tip-icon"><Icon name="spark" size={21} /></span>
      <strong>Ready to create a listing?</strong>
      <p>Publish a service, product, or hiring request from one workspace.</p>
      <button type="button" onClick={() => onNavigate('listings')}>Create a listing <Icon name="arrow" size={16} /></button>
    </div>
    <div className="sidebar-footer">jobNshop workspace</div>
  </aside>
}
