import nodemailer from 'nodemailer'
import { ApiError } from '../common/utils/ApiError.js'

export async function sendPasswordReset(email, otp) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new ApiError(503, 'Password recovery is temporarily unavailable.')
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Your Servnix password reset code',
    text: `Your password reset code is ${otp}. It expires in 20 minutes.\n\nIf you did not request this, you can ignore this email.`,
  })
}
