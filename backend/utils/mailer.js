/**
 * Email (django.core.mail.send_mail / EmailMessage) using nodemailer + SMTP settings.
 */
import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter = null;

if (!config.EMAIL_HOST_USER || !config.EMAIL_HOST_PASSWORD) {
  console.warn(
    'RuntimeWarning: Email credentials (EMAIL_HOST_USER, EMAIL_HOST_PASSWORD) are not set. ' +
      'Email functionality will not work until these are configured.'
  );
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      secure: config.EMAIL_USE_SSL || config.EMAIL_PORT === 465,
      requireTLS: config.EMAIL_USE_TLS && !config.EMAIL_USE_SSL,
      auth: config.EMAIL_HOST_USER ? { user: config.EMAIL_HOST_USER, pass: config.EMAIL_HOST_PASSWORD } : undefined,
      connectionTimeout: config.EMAIL_TIMEOUT,
      greetingTimeout: config.EMAIL_TIMEOUT,
      socketTimeout: config.EMAIL_TIMEOUT,
    });
  }
  return transporter;
}

/**
 * send_mail(subject, message, from_email, recipient_list, fail_silently=False)
 * Throws on failure unless failSilently is true.
 */
export async function sendMail({ subject, message, from, to, attachments, failSilently = false }) {
  try {
    if (!config.EMAIL_HOST_USER || !config.EMAIL_HOST_PASSWORD) {
      throw new Error('SMTP credentials are not configured');
    }
    await getTransporter().sendMail({
      from: from || config.DEFAULT_FROM_EMAIL,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: message,
      attachments,
    });
    return 1;
  } catch (err) {
    if (failSilently) return 0;
    throw err;
  }
}
