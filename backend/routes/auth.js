/**
 * Authentication views: signup_view, login_view, logout_view,
 * forgot_password, verify_otp, reset_password (pehchan/views.py)
 */
import crypto from 'node:crypto';
import { Router } from 'express';

import config from '../config.js';
import { User, PasswordResetOTP } from '../models/index.js';
import { authenticate, login, logout, loginRequired } from '../middleware/auth.js';
import { makePassword, validatePassword } from '../utils/passwords.js';
import { FormErrors, ValidationError, cleanChar, cleanEmail, FAKE_EMAIL_DOMAINS, validateUsername, MSG } from '../utils/forms.js';
import { sendMail } from '../utils/mailer.js';
import { ah, success, error, warning } from '../utils/http.js';
import { userFull } from '../utils/serializers.js';

const router = Router();

router.get('/me/', (req, res) => {
  res.json({ ok: true, user: userFull(req.user) });
});

// ---------------------------------------------------------------------------
// SignUpForm (UserCreationForm + email/first_name/last_name)
// ---------------------------------------------------------------------------
async function validateSignup(body) {
  const errors = new FormErrors();
  const cleaned = {};
  const run = (field, fn) => {
    try {
      cleaned[field] = fn();
    } catch (e) {
      if (e instanceof ValidationError) errors.add(field, e.messages);
      else throw e;
    }
  };

  // username: max 150, UnicodeUsernameValidator, case-insensitive uniqueness (Django 4.2+)
  run('username', () => validateUsername(cleanChar(body.username, { maxLength: 150 })));
  if (cleaned.username && !errors.has('username')) {
    const exists = await User.count({ where: { username: cleaned.username } });
    if (exists) errors.add('username', 'A user with that username already exists.');
  }

  // email: required, lower-cased, no disposable domains, unique (iexact)
  run('email', () => {
    const email = cleanEmail(body.email, { maxLength: 254 }).trim().toLowerCase();
    if (!email) throw new ValidationError('Email is required.');
    const domain = email.includes('@') ? email.split('@').pop() : '';
    if (FAKE_EMAIL_DOMAINS.includes(domain)) {
      throw new ValidationError('Disposable or fake email addresses are not allowed. Please enter a valid email.');
    }
    return email;
  });
  if (cleaned.email && !errors.has('email')) {
    const exists = await User.count({ where: { email: cleaned.email } });
    if (exists) errors.add('email', 'An account with this email address already exists.');
  }

  const nameCheck = (label) => (v) => {
    const s = cleanChar(v, { maxLength: 100 }).trim();
    if (s.length < 2 || !/^[\p{L}]+$/u.test(s.replace(/ /g, ''))) {
      throw new ValidationError(`${label} must contain at least 2 alphabetic characters.`);
    }
    return s;
  };
  run('first_name', () => nameCheck('First name')(body.first_name));
  run('last_name', () => nameCheck('Last name')(body.last_name));

  // password1 / password2 (strip=False)
  run('password1', () => cleanChar(body.password1, { strip: false }));
  run('password2', () => cleanChar(body.password2, { strip: false }));
  if (cleaned.password1 && cleaned.password2 && cleaned.password1 !== cleaned.password2) {
    errors.add('password2', 'The two password fields didn’t match.');
  }
  if (cleaned.password2 && !errors.has('password2')) {
    const pwErrors = validatePassword(cleaned.password2, {
      username: cleaned.username || body.username || '',
      first_name: cleaned.first_name || '',
      last_name: cleaned.last_name || '',
      email: cleaned.email || '',
    });
    if (pwErrors.length) errors.add('password2', pwErrors);
  }
  return { cleaned, errors };
}

const FIELD_LABELS = { username: 'Username', email: 'Email', first_name: 'First Name', last_name: 'Last Name', password1: 'Password1', password2: 'Confirm Password' };

router.post(
  '/signup/',
  ah(async (req, res) => {
    const body = req.body || {};
    const { cleaned, errors } = await validateSignup(body);
    if (!errors.isValid) {
      if (body.context === 'donate') {
        // public_donate: one message per error, "<Field Name>: <error>"
        const messages = [];
        for (const [field, list] of Object.entries(errors.errors)) {
          for (const e of list) {
            if (field === '__all__') messages.push(error(e));
            else messages.push(error(`${FIELD_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: ${e}`));
          }
        }
        return res.status(400).json({ ok: false, errors: errors.errors, messages });
      }
      return res.status(400).json({ ok: false, errors: errors.errors, messages: [error('Please correct the errors below.')] });
    }
    const user = await User.create({
      username: cleaned.username,
      email: cleaned.email,
      first_name: cleaned.first_name,
      last_name: cleaned.last_name,
      password: await makePassword(cleaned.password1),
      date_joined: new Date(),
    });
    await login(req, user);
    res.json({
      ok: true,
      user: userFull(user),
      messages: [success('Registration successful! Welcome to Pehchan.')],
      redirect: '/dashboard/',
    });
  })
);

router.post(
  '/login/',
  ah(async (req, res) => {
    const body = req.body || {};
    const username = body.username ?? '';
    const password = body.password ?? '';
    if (body.context === 'donate') {
      const user = await authenticate(username, password);
      if (user) {
        await login(req, user);
        return res.json({ ok: true, user: userFull(user), messages: [success(`Welcome back, ${username}!`)], redirect: '/dashboard/' });
      }
      return res.status(400).json({ ok: false, messages: [error('Invalid username or password. Please try again.')] });
    }

    // LoginForm (AuthenticationForm)
    const errors = new FormErrors();
    const u = String(username).trim();
    if (!u) errors.add('username', MSG.required);
    else if (u.length > 150) errors.add('username', MSG.maxLength(150, u.length));
    if (!password) errors.add('password', MSG.required);
    if (errors.isValid) {
      const user = await authenticate(u, password);
      if (user) {
        await login(req, user);
        return res.json({ ok: true, user: userFull(user), messages: [success(`Welcome back, ${u}!`)], redirect: '/dashboard/' });
      }
      errors.add('__all__', 'Please enter a correct username and password. Note that both fields may be case-sensitive.');
    }
    return res.status(400).json({ ok: false, errors: errors.errors, messages: [error('Invalid username or password.')] });
  })
);

router.post(
  '/logout/',
  loginRequired,
  ah(async (req, res) => {
    await logout(req);
    res.json({ ok: true, user: null, messages: [success('You have been logged out successfully.')], redirect: '/' });
  })
);

// ---------------------------------------------------------------------------
// Forgot password (OTP by email)
// ---------------------------------------------------------------------------
router.post(
  '/forgot-password/',
  ah(async (req, res) => {
    const s = req.session;
    let email;
    try {
      email = cleanEmail(req.body?.email);
    } catch (e) {
      return res.status(400).json({ ok: false, errors: { email: e.messages } });
    }

    const nowTs = Date.now() / 1000;
    if (s.last_otp_request_time && nowTs - s.last_otp_request_time < 60) {
      return res
        .status(400)
        .json({ ok: false, messages: [warning('Please wait at least 60 seconds before requesting another OTP.')] });
    }

    const users = await User.findAll({ where: { email } });
    // User.objects.get(email=email): exact match, MultipleObjectsReturned would crash in Django – use first exact match
    const user = users.find((u) => u.email === email) || null;
    if (user) {
      await PasswordResetOTP.destroy({ where: { user_id: user.id } });
      const otp = String(crypto.randomInt(0, 900000) + 100000);
      await PasswordResetOTP.create({ user_id: user.id, otp, expires_at: new Date(Date.now() + 10 * 60 * 1000) });

      const message = `
                Hello ${user.username},

                You have requested to reset your password. Please use the following OTP to reset your password:

                OTP: ${otp}

                This OTP is valid for 10 minutes.

                If you did not request this, please ignore this email.

                Best regards,
                Pehchan Team
                `;
      try {
        await sendMail({ subject: 'Pehchan - Password Reset OTP', message, from: config.EMAIL_HOST_USER || undefined, to: [email] });
      } catch (err) {
        console.error('OTP email failed:', err.message);
        await PasswordResetOTP.destroy({ where: { user_id: user.id, otp } });
        return res.json({
          ok: false,
          messages: [error('Failed to send OTP email. Please try again later or contact support.')],
          redirect: '/forgot-password/',
        });
      }
      s.reset_user_id = user.id;
      s.otp_initiated = true;
      s.otp_attempts = 0;
      s.last_otp_request_time = nowTs;
    } else {
      s.otp_initiated = true;
      s.last_otp_request_time = nowTs;
    }
    return res.json({
      ok: true,
      messages: [success('If an account exists with this email address, an OTP has been sent.')],
      redirect: '/verify-otp/',
    });
  })
);

async function otpGuard(req) {
  const s = req.session;
  if (!s.otp_initiated) {
    return { ok: false, messages: [error('Invalid request. Please try again.')], redirect: '/forgot-password/' };
  }
  const attempts = s.otp_attempts || 0;
  if (attempts >= 5) {
    if (s.reset_user_id) await PasswordResetOTP.destroy({ where: { user_id: s.reset_user_id } });
    delete s.reset_user_id;
    delete s.otp_attempts;
    return { ok: false, messages: [error('Too many incorrect attempts. Please request a new OTP.')], redirect: '/forgot-password/' };
  }
  return null;
}

router.get(
  '/verify-otp/',
  ah(async (req, res) => {
    const blocked = await otpGuard(req);
    if (blocked) return res.json(blocked);
    return res.json({ ok: true });
  })
);

router.post(
  '/verify-otp/',
  ah(async (req, res) => {
    const blocked = await otpGuard(req);
    if (blocked) return res.json(blocked);
    const s = req.session;
    let otp;
    try {
      otp = cleanChar(req.body?.otp, { maxLength: 6 });
    } catch (e) {
      return res.status(400).json({ ok: false, errors: { otp: e.messages } });
    }
    const attempts = s.otp_attempts || 0;
    const userId = s.reset_user_id;
    if (!userId) {
      // Django raises KeyError here (session has no reset_user_id) -> server error page
      return res.status(500).json({ ok: false, server_error: true });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.json({ ok: false, messages: [error('Invalid request. Please try again.')], redirect: '/forgot-password/' });
    }
    const record = await PasswordResetOTP.findOne({ where: { user_id: user.id, otp } });
    if (record && record.isValid()) {
      await record.destroy();
      s.otp_verified = true;
      s.reset_user_id = user.id;
      delete s.otp_attempts;
      return res.json({ ok: true, messages: [success('OTP verified successfully.')], redirect: '/reset-password/' });
    }
    s.otp_attempts = attempts + 1;
    const remaining = 5 - (attempts + 1);
    if (remaining > 0) {
      return res
        .status(400)
        .json({ ok: false, messages: [error(`Invalid or expired OTP. You have ${remaining} attempt(s) remaining.`)] });
    }
    await PasswordResetOTP.destroy({ where: { user_id: user.id } });
    delete s.reset_user_id;
    delete s.otp_attempts;
    return res.json({ ok: false, messages: [error('Too many incorrect attempts. Please request a new OTP.')], redirect: '/forgot-password/' });
  })
);

async function resetGuard(req) {
  const s = req.session;
  if (!s.reset_user_id || !s.otp_verified) {
    return { blocked: { ok: false, messages: [error('Please verify your OTP first.')], redirect: '/forgot-password/' } };
  }
  const user = await User.findByPk(s.reset_user_id);
  if (!user) {
    delete s.reset_user_id;
    delete s.otp_verified;
    return { blocked: { ok: false, messages: [error('Invalid request. Please try again.')], redirect: '/forgot-password/' } };
  }
  return { user };
}

router.get(
  '/reset-password/',
  ah(async (req, res) => {
    const { blocked } = await resetGuard(req);
    if (blocked) return res.json(blocked);
    return res.json({ ok: true });
  })
);

router.post(
  '/reset-password/',
  ah(async (req, res) => {
    const { blocked, user } = await resetGuard(req);
    if (blocked) return res.json(blocked);
    const errors = new FormErrors();
    let newPassword = '';
    let confirm = '';
    try {
      newPassword = cleanChar(req.body?.new_password);
      const pwErrors = validatePassword(newPassword, user);
      if (pwErrors.length) throw new ValidationError(pwErrors);
    } catch (e) {
      errors.add('new_password', e.messages);
    }
    try {
      confirm = cleanChar(req.body?.confirm_password);
    } catch (e) {
      errors.add('confirm_password', e.messages);
    }
    if (!errors.has('new_password') && newPassword && confirm && newPassword !== confirm) {
      errors.add('__all__', 'Passwords do not match.');
    }
    if (!errors.isValid) {
      const messages = [];
      Object.values(errors.errors).forEach((list) => list.forEach((m) => messages.push(error(m))));
      return res.status(400).json({ ok: false, errors: errors.errors, messages });
    }
    user.password = await makePassword(newPassword);
    await user.save();
    delete req.session.reset_user_id;
    delete req.session.otp_verified;
    return res.json({
      ok: true,
      messages: [success('Your password has been reset successfully. You can now login with your new password.')],
      redirect: '/login/',
    });
  })
);

export default router;
