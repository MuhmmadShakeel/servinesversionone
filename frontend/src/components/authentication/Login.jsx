import { useState } from 'react'
import { toast } from 'react-toastify'
import { Icon } from '../common/Icon.jsx'
import { authErrorMessage, useLoginMutation } from '../../redux/Api/auth/AuthApi.js'

export default function Login({ onSwitch, onForgot, onAuthenticated, registeredEmail }) {
  const [login, { isLoading }] = useLoginMutation()
  const [visible, setVisible] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const session = await login({ email: form.get('email').trim(), password: form.get('password') }).unwrap()
      onAuthenticated(session)
      toast.success('Welcome back.')
    } catch (failure) { toast.error(authErrorMessage(failure)) }
  }

  return <div className="auth-panel">
    <p className="auth-lead">Pick up where you left off. Your services, projects and marketplace are waiting.</p>
    <form onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="email" defaultValue={registeredEmail || ''} placeholder="you@example.com" required /></label>
      <label>Password<span className="password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}><Icon name={visible ? 'eyeOff' : 'eye'} size={18}/></button></span></label>
      <button className="forgot-link" type="button" onClick={onForgot}>Forgot password?</button>
      <button className="primary-button auth-submit" type="submit" disabled={isLoading}>{isLoading ? 'Logging in…' : 'Log in'}<Icon name="arrow" size={17}/></button>
    </form>
    <div className="auth-divider"><span>New to jobNshop?</span></div>
    <button className="auth-switch" type="button" onClick={onSwitch}>Create your account <Icon name="arrow" size={16}/></button>
  </div>
}
