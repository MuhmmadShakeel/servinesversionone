import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { Icon } from './Icon.jsx'
import { SurfaceModal } from './UiParts.jsx'
import Login from '../authentication/Login.jsx'
import Signup from '../authentication/Signup.jsx'
import PasswordRecovery from '../authentication/PasswordRecovery.jsx'
import { authApi, authErrorMessage, clearSession, getAccessToken, getStoredUser, saveSession, useLogoutMutation, useMeQuery, useUpdateProfileImageMutation } from '../../redux/Api/auth/AuthApi.js'
import { serviceApi } from '../../redux/Api/service/ServiceApi.js'
import { hiringApi } from '../../redux/Api/hiring/HiringApi.js'
import { productApi } from '../../redux/Api/product/ProductApi.js'
import { chatApi } from '../../redux/Api/chat/ChatApi.js'


export function Navbar() {
  const dispatch = useDispatch()
  const [token, setToken] = useState(getAccessToken)
  const [localUser, setLocalUser] = useState(getStoredUser)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [panel, setPanel] = useState(null)
  const [logout, { isLoading: loggingOut }] = useLogoutMutation()
  const [updateProfileImage, { isLoading: uploadingImage }] = useUpdateProfileImageMutation()
  const [profileImageUrl, setProfileImageUrl] = useState(null)
  const [imageVersion, setImageVersion] = useState(0)
  const { data, error } = useMeQuery(token, { skip: !token })
  const user = token && error?.status !== 401 ? data?.user || localUser : null

  useEffect(() => {
    if (!token || !user?.hasProfileImage) return undefined
    const controller = new AbortController()
    let objectUrl
    fetch('/v1/auth/me/image', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Profile picture unavailable'); return response.blob() })
      .then((blob) => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setProfileImageUrl(objectUrl) } })
      .catch(() => {})
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [token, user?.hasProfileImage, imageVersion])

  async function uploadProfileImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      toast.error('Choose a PNG, JPEG, or WebP picture smaller than 1 MB.')
      return
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await updateProfileImage({ mimeType: file.type, base64 }).unwrap()
      setLocalUser((current) => ({ ...current, hasProfileImage: true }))
      setImageVersion((version) => version + 1)
      toast.success('Profile picture updated.')
    } catch (failure) { toast.error(authErrorMessage(failure)) }
  }

  useEffect(() => {
    if (error?.status === 401) clearSession()
  }, [error])

  function authenticated(session) {
    dispatch(serviceApi.util.resetApiState())
    dispatch(hiringApi.util.resetApiState())
    dispatch(productApi.util.resetApiState())
    dispatch(chatApi.util.resetApiState())
    saveSession(session)
    setToken(session.token)
    setLocalUser(session.user)
    setRegisteredEmail('')
    setPanel(null)
  }

  function registered(email) {
    setRegisteredEmail(email)
    setPanel('login')
  }

  async function signOut() {
    let serverSignedOut = false
    try {
      await logout(token).unwrap()
      serverSignedOut = true
    } catch { /* Still clear the local session if the server cannot be reached. */ }
    clearSession()
    setToken(null)
    setLocalUser(null)
    setPanel(null)
    dispatch(authApi.util.resetApiState())
    dispatch(serviceApi.util.resetApiState())
    dispatch(hiringApi.util.resetApiState())
    dispatch(productApi.util.resetApiState())
    dispatch(chatApi.util.resetApiState())
    if (serverSignedOut) toast.success('You have logged out.')
    else toast.error('Signed out on this device. The server could not confirm logout.')
  }

  const title = panel === 'signup' ? 'Join jobNshop' : panel === 'login' ? 'Welcome back' : panel === 'recovery' ? 'Reset your password' : 'Your profile'

  return <>
    <header className="topbar">
      <div className="topbar-left"><span className="topbar-greeting">Your marketplace for work and more.</span></div>
      <div className="topbar-actions">
        {user ? <><span className="topbar-user">Hi, {user.name.split(' ')[0]}</span><button className="logout-button" type="button" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button></> : <><button className="text-button" type="button" onClick={() => setPanel('login')}>Log in</button>{!registeredEmail && <button className="signup-button" type="button" onClick={() => setPanel('signup')}>Sign up <Icon name="arrow" size={16} /></button>}</>}
        <button className="profile-button" type="button" aria-label="Profile" onClick={() => setPanel('profile')}>{profileImageUrl && user ? <img className="profile-avatar-image" src={profileImageUrl} alt="" /> : <Icon name="user" size={19} />}</button>
      </div>
    </header>
    {panel && <SurfaceModal title={title} onClose={() => setPanel(null)}>
      {panel === 'login' && <Login onSwitch={() => setPanel('signup')} onForgot={() => setPanel('recovery')} onAuthenticated={authenticated} registeredEmail={registeredEmail} />}
      {panel === 'signup' && <Signup onSwitch={() => setPanel('login')} onRegistered={registered} />}
      {panel === 'recovery' && <PasswordRecovery onBack={() => setPanel('login')} onReset={() => setPanel('login')} />}
      {panel === 'profile' && (user ? <div className="profile-preview"><span>{profileImageUrl ? <img className="profile-avatar-image" src={profileImageUrl} alt="Your profile" /> : <Icon name="user" size={28}/>}</span><h3>{user.name}</h3><p>{user.email}</p><label className="profile-upload-button">{uploadingImage ? 'Uploading picture...' : 'Change profile picture'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadProfileImage} disabled={uploadingImage} /></label><small className="profile-upload-hint">PNG, JPEG, or WebP · up to 1 MB</small><button className="secondary-button" type="button" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Logging out…' : 'Log out'}</button></div> : <div className="profile-preview"><span><Icon name="user" size={28}/></span><h3>Your workspace is ready</h3><p>{registeredEmail ? 'Your account is ready. Log in to continue.' : 'Log in or create an account to make this dashboard yours.'}</p><button className="primary-button" type="button" onClick={() => setPanel(registeredEmail ? 'login' : 'signup')}>{registeredEmail ? 'Log in' : 'Get started'} <Icon name="arrow" size={16}/></button></div>)}
    </SurfaceModal>}
  </>
}
