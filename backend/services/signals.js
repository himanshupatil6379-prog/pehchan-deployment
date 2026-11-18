/**
 * pehchan/signals.py – post_save receivers, implemented as Sequelize afterCreate hooks.
 */
import { MoneyDonation, Expense, Certificate, DonorCertificate, User, Event, EventVolunteer } from '../models/index.js';
import { deposit, withdraw } from './wallet.js';
import { sendMail } from '../utils/mailer.js';
import { absoluteMediaPath } from '../utils/uploads.js';

const afterCommit = (options, fn) => {
  if (options && options.transaction) options.transaction.afterCommit(() => fn());
  else fn();
};

let registered = false;

export function registerSignals() {
  if (registered) return;
  registered = true;

  // Automatically deposit money to wallet when a money donation is made
  MoneyDonation.addHook('afterCreate', 'handle_donation_wallet_transaction', async (instance, options) => {
    const user = await User.findByPk(instance.user_id, { transaction: options.transaction });
    const name = user ? user.getFullName() || user.username : '';
    await deposit(instance.amount, {
      description: `Donation from ${name}`,
      transactionType: 'donation',
      transaction: options.transaction,
    });
  });

  // Automatically withdraw money from wallet when an expense is created
  Expense.addHook('afterCreate', 'handle_expense_wallet_transaction', async (instance, options) => {
    await withdraw(instance.amount, {
      description: `Expense: ${instance.title}`,
      transactionType: 'expense',
      transaction: options.transaction,
    });
  });

  // Email the volunteer when their certificate is issued
  Certificate.addHook('afterCreate', 'email_volunteer_certificate', async (instance, options) => {
    const volunteer = await EventVolunteer.findByPk(instance.volunteer_id, {
      include: [{ model: User, as: 'user' }],
      transaction: options.transaction,
    });
    const ev = await Event.findByPk(instance.event_id, { transaction: options.transaction });
    if (!volunteer || !volunteer.user || !volunteer.user.email) return;
    afterCommit(options, () => {
      sendMail({
        subject: `Your Volunteer Certificate - ${ev ? ev.name : ''}`,
        message: `Hello ${volunteer.user.username},\n\nThank you for volunteering at '${ev ? ev.name : ''}'.\nYour certificate is attached below.`,
        to: [volunteer.user.email],
        attachments: instance.file ? [{ path: absoluteMediaPath(instance.file) }] : undefined,
        failSilently: true,
      }).catch((e) => console.log(`Certificate email failed: ${e.message}`));
    });
  });

  // Email the donor when their certificate is issued
  DonorCertificate.addHook('afterCreate', 'email_donor_certificate', async (instance, options) => {
    const user = await User.findByPk(instance.user_id, { transaction: options.transaction });
    if (!user || !user.email) return;
    afterCommit(options, () => {
      sendMail({
        subject: 'Thank You for Your Donation - Pehchan NGO',
        message: `Hello ${user.username},\n\nThank you for your generous donation.\nYour donor certificate is attached.`,
        to: [user.email],
        attachments: instance.file ? [{ path: absoluteMediaPath(instance.file) }] : undefined,
        failSilently: true,
      }).catch((e) => console.log(`Donor certificate email failed: ${e.message}`));
    });
  });
}
