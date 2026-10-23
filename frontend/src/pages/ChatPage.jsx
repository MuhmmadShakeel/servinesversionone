import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Icon } from '../components/common/Icon.jsx'
import { PageHeader } from '../components/common/PageHeader.jsx'
import { EmptyState, RequestError, SurfaceModal } from '../components/common/UiParts.jsx'
import { getStoredUser, useAuthToken } from '../redux/Api/auth/AuthApi.js'
import {
  useGetConversationsQuery, useGetMessagesQuery, useLazyGetMessagesQuery,
  useSendMessageMutation, useStartConversationMutation, useEditMessageMutation,
  useDeleteMessageMutation, useClearConversationMutation,
  useMarkReadMutation,
} from '../redux/Api/chat/ChatApi.js'

const dateTime = new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
const time = (value) => dateTime.format(new Date(value))
const kindLabel = { service: 'Service', hiring: 'Job', product: 'Product' }

export function ChatPage({ chatTarget }) {
  const token = useAuthToken()
  const user = getStoredUser()
  const [selectedId, setSelectedId] = useState(chatTarget?.conversation || null)
  const [olderMessages, setOlderMessages] = useState([])
  const [olderCursor, setOlderCursor] = useState(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [openingError, setOpeningError] = useState('')
  const endRef = useRef(null)
  const conversationsQuery = useGetConversationsQuery(undefined, { skip: !token, pollingInterval: 15000, skipPollingIfUnfocused: true, refetchOnFocus: true })
  const messagesQuery = useGetMessagesQuery({ id: selectedId }, { skip: !token || !selectedId, pollingInterval: 4000, skipPollingIfUnfocused: true, refetchOnFocus: true })
  const [startConversation, { isLoading: opening }] = useStartConversationMutation()
  const [loadMessages, { isFetching: loadingOlder }] = useLazyGetMessagesQuery()
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()
  const [editMessage, { isLoading: editing }] = useEditMessageMutation()
  const [deleteMessage, { isLoading: deleting }] = useDeleteMessageMutation()
  const [clearConversation, { isLoading: clearing }] = useClearConversationMutation()
  const [markRead] = useMarkReadMutation()

  useEffect(() => {
    if (!token || !chatTarget) return
    if (chatTarget.conversation) return
    if (!chatTarget.context || !chatTarget.id) return
    let active = true
    startConversation({ context: chatTarget.context, id: chatTarget.id }).unwrap()
      .then(({ conversation }) => {
        if (!active) return
        setSelectedId(conversation.id)
        setOlderMessages([])
        setOlderCursor(null)
        setOpeningError('')
        window.history.replaceState({}, '', `/chat?conversation=${conversation.id}`)
      })
      .catch((error) => { if (active) { const message = error?.data?.message || 'This chat could not be opened.'; setOpeningError(message); toast.error(message) } })
    return () => { active = false }
  }, [chatTarget, token, startConversation])

  const conversations = conversationsQuery.data?.conversations || []
  const selected = conversations.find((item) => item.id === selectedId)
  const messages = useMemo(() => {
    const unique = new Map([...olderMessages, ...(messagesQuery.data?.messages || [])].map((item) => [item.id, item]))
    return [...unique.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id))
  }, [olderMessages, messagesQuery.data?.messages])
  const cursor = olderMessages.length ? olderCursor : messagesQuery.data?.nextCursor
  const newestId = messages.at(-1)?.id
  const latestLoadedId = [...(messagesQuery.currentData?.messages || [])]
    .reverse()
    .find((message) => !message.pending)?.id

  useEffect(() => { if (newestId) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [newestId])

  useEffect(() => {
    if (!token || !selectedId || !latestLoadedId) return undefined
    const acknowledge = () => {
      if (document.visibilityState === 'visible') markRead({ id: selectedId, messageId: latestLoadedId }).unwrap().catch(() => {})
    }
    acknowledge()
    document.addEventListener('visibilitychange', acknowledge)
    return () => document.removeEventListener('visibilitychange', acknowledge)
  }, [token, selectedId, latestLoadedId, markRead])

  function selectConversation(id) {
    setSelectedId(id)
    setOlderMessages([])
    setOlderCursor(null)
    setOpeningError('')
    setEditingId(null)
    setDeleteTarget(null)
    setConfirmClear(false)
    window.history.replaceState({}, '', `/chat?conversation=${id}`)
  }

  async function loadEarlier() {
    if (!cursor || !selectedId || loadingOlder) return
    try {
      const page = await loadMessages({ id: selectedId, before: cursor }).unwrap()
      setOlderMessages((current) => [...page.messages, ...current])
      setOlderCursor(page.nextCursor)
    } catch { toast.error('Earlier messages could not load.') }
  }

  async function submit(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selectedId || sending) return
    setDraft('')
    try {
      await sendMessage({ id: selectedId, body }).unwrap()
    } catch (error) { setDraft(body); toast.error(error?.data?.message || 'Message could not be sent.') }
  }

  async function saveEdit(event) {
    event.preventDefault()
    const body = editDraft.trim()
    if (!body || !editingId || editing) return
    try {
      const result = await editMessage({ id: selectedId, messageId: editingId, body }).unwrap()
      setOlderMessages((current) => current.map((item) => item.id === editingId ? { ...result.message, seenAt: item.seenAt } : item))
      setEditingId(null)
      setEditDraft('')
      toast.success('Message updated.')
    } catch (error) { toast.error(error?.data?.message || 'Message could not be updated.') }
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget || deleting) return
    try {
      await deleteMessage({ id: selectedId, messageId: deleteTarget.id }).unwrap()
      setOlderMessages((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('Message deleted.')
    } catch (error) { toast.error(error?.data?.message || 'Message could not be deleted.') }
  }

  async function clearChat() {
    if (!selectedId || clearing) return
    try {
      await clearConversation(selectedId).unwrap()
      setOlderMessages([])
      setOlderCursor(null)
      setEditingId(null)
      setConfirmClear(false)
      toast.success('Chat cleared for you.')
    } catch (error) { toast.error(error?.data?.message || 'Chat could not be cleared.') }
  }

  return <>
    <PageHeader stats="chat" eyebrow="PRIVATE CONVERSATIONS" title="Messages" description="Talk directly with the people behind your services, hiring posts, and products."/>
    {!token ? <EmptyState label="Log in to see your messages" detail="Conversations are private to the two people involved."/> : <div className="chat-layout">
      <aside className="chat-inbox" aria-label="Conversations">
        <div className="chat-inbox-heading"><span><Icon name="chat" size={19}/> Inbox</span><strong>{conversations.length}</strong></div>
        {conversationsQuery.isLoading ? <p className="chat-inbox-note" role="status">Loading conversations...</p> : conversationsQuery.isError && !conversationsQuery.data ? <RequestError onRetry={conversationsQuery.refetch}/> : conversations.length ? conversations.map((item) => <button key={item.id} type="button" className={`chat-inbox-item ${selectedId === item.id ? 'active' : ''}`} onClick={() => selectConversation(item.id)}><span className="chat-avatar">{item.otherUserName?.charAt(0).toUpperCase()}</span><span className="chat-inbox-copy"><strong className="chat-inbox-name">{item.otherUserName}</strong><small>{kindLabel[item.listingType]} · {item.listingTitle}</small><span className="chat-inbox-preview"><span>{item.lastMessage || 'Start the conversation'}</span>{item.unreadCount > 0 && <b className="chat-unread-count" aria-label={`${item.unreadCount} unread messages`}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</b>}</span></span></button>) : <div className="chat-inbox-empty"><Icon name="chat" size={27}/><strong>No conversations yet</strong><p>Use a chat button on a listing, booking, proposal, cart item, or order.</p></div>}
      </aside>
      <section className="chat-thread" aria-label="Messages">
        {opening ? <div className="chat-thread-empty">Opening your conversation…</div> : openingError ? <div className="chat-thread-empty" role="alert">{openingError}</div> : !selectedId ? <div className="chat-thread-empty"><span><Icon name="chat" size={34}/></span><h2>Your conversations, together.</h2><p>Select a conversation or use a chat button anywhere in the marketplace.</p></div> : <>
          <div className="chat-thread-heading"><span className="chat-avatar">{selected?.otherUserName?.charAt(0).toUpperCase() || '•'}</span><div><strong>{selected?.otherUserName || 'Conversation'}</strong><small>{selected ? `${kindLabel[selected.listingType]} · ${selected.listingTitle}` : 'Private conversation'}</small></div><button className="chat-clear-button" type="button" onClick={() => setConfirmClear(true)} disabled={clearing}><Icon name="trash" size={16}/> Clear chat</button></div>
          <div className="chat-message-list">{messagesQuery.isLoading ? <div className="chat-thread-empty">Loading messages…</div> : messagesQuery.isError && !messagesQuery.data ? <RequestError title="Messages unavailable" onRetry={messagesQuery.refetch}/> : <>{cursor && <button type="button" className="chat-load-more" onClick={loadEarlier} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}{messages.length ? messages.map((message) => <div key={message.id} className={`chat-message ${message.senderUserId === user?.id ? 'mine' : ''}`}><span>{message.senderUserId === user?.id ? 'You' : message.senderName}</span>{editingId === message.id ? <form className="chat-edit-form" onSubmit={saveEdit}><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} maxLength="2000" rows="3" aria-label="Edit message"/><div><button type="button" onClick={() => setEditingId(null)} disabled={editing}>Cancel</button><button type="submit" disabled={!editDraft.trim() || editing}>{editing ? 'Saving…' : 'Save'}</button></div></form> : <p>{message.body}</p>}<div className="chat-message-footer"><time dateTime={message.createdAt}>{time(message.createdAt)}{message.editedAt ? ' · Edited' : ''}{message.pending ? ' · Sending…' : ''}</time>{message.senderUserId === user?.id && !message.pending && <span className={`chat-read-receipt ${message.seenAt ? 'seen' : ''}`} aria-label={message.seenAt ? 'Seen by recipient' : 'Sent'} title={message.seenAt ? 'Seen by recipient' : 'Sent'}>{message.seenAt ? '✓✓' : '✓'}</span>}{message.senderUserId === user?.id && !message.pending && editingId !== message.id && <span className="chat-message-actions"><button type="button" onClick={() => { setEditingId(message.id); setEditDraft(message.body) }} aria-label="Edit message"><Icon name="edit" size={13}/> Edit</button><button type="button" onClick={() => setDeleteTarget(message)} aria-label="Delete message"><Icon name="trash" size={13}/> Delete</button></span>}</div></div>) : <div className="chat-first-message">Say hello to start this private conversation.</div>}<div ref={endRef}/></>}</div>
          <form className="chat-composer" onSubmit={submit}><label htmlFor="chat-message">Message {selected?.otherUserName || 'your contact'}</label><div><textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" rows="2" maxLength="2000" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }}/><button type="submit" disabled={!draft.trim() || sending}>{sending ? 'Sending…' : 'Send'} <Icon name="arrow" size={16}/></button></div><small>Only you and this person can read this chat.</small></form>
        </>}
      </section>
    </div>}
    {deleteTarget && <SurfaceModal title="Delete message?" onClose={() => { if (!deleting) setDeleteTarget(null) }}><p className="chat-confirm-copy">This message will be removed for both people in the conversation.</p><div className="chat-confirm-actions"><button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button><button type="button" className="delete-button" onClick={confirmDeleteMessage} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete message'}</button></div></SurfaceModal>}
    {confirmClear && <SurfaceModal title="Clear this chat?" onClose={() => { if (!clearing) setConfirmClear(false) }}><p className="chat-confirm-copy">Your message history in this conversation will be cleared. The other person will still see their copy.</p><div className="chat-confirm-actions"><button type="button" className="secondary-button" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</button><button type="button" className="delete-button" onClick={clearChat} disabled={clearing}>{clearing ? 'Clearing…' : 'Clear my chat'}</button></div></SurfaceModal>}
  </>
}
