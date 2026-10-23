import { useState } from 'react'
import { toast } from 'react-toastify'
import { Icon } from '../common/Icon.jsx'
import { authErrorMessage, useForgotPasswordMutation, useResetPasswordMutation } from '../../redux/Api/auth/AuthApi.js'

export default function PasswordRecovery({ onBack, onReset }) {
  const [forgotPassword, { isLoading: sending }] = useForgotPasswordMutation()
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation()
  const [email, setEmail] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [visible, setVisible] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      if (codeSent) {
        const password = form.get('password')
        if (password !== form.get('confirmPassword')) { toast.error('Passwords do not match.'); return }
        const result = await resetPassword({ email, otp: form.get('otp'), password }).unwrap()
        toast.success(result.message)
        onReset()
      } else {
        const address = String(form.get('email')).trim()
        const result = await forgotPassword(address).unwrap()
        setEmail(address)
        setCodeSent(true)
        toast.success(result.message)
      }
    } catch (failure) { toast.error(authErrorMessage(failure)) }
  }

  return <div className="auth-panel">
    <p className="auth-lead">{codeSent ? `Enter the six digit code sent to ${email} and choose a new password.` : 'Enter your email and we will send you a password reset code.'}</p>
    <form onSubmit={submit}>
      {codeSent ? <><label>Reset code<input name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" placeholder="Six digit code" required /></label><label>New password<span className="password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength="8" placeholder="New password" required /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}><Icon name={visible ? 'eyeOff' : 'eye'} size={18}/></button></span></label><p className="password-hint">At least 8 characters, with uppercase, lowercase and a number.</p><label>Confirm password<input name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat new password" required /></label></> : <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>}
      <button className="primary-button auth-submit" type="submit" disabled={sending || resetting}>{sending || resetting ? 'Please wait…' : codeSent ? 'Reset password' : 'Send reset code'}<Icon name="arrow" size={17}/></button>
    </form>
    {codeSent && <button className="auth-back" type="button" onClick={() => setCodeSent(false)}>Use another email</button>}
    <button className="auth-back" type="button" onClick={onBack}><Icon name="arrow" size={15}/>Back to login</button>
  </div>
}
