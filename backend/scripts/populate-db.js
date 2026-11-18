/**
 * Port of populate_db.py – seeds demo users, the "Prarambh" event, a volunteer and a certificate.
 *   npm run populate
 */
import { sequelize, User, Event, EventVolunteer, LifetimeVolunteer, Certificate } from '../models/index.js';
import { makePassword } from '../utils/passwords.js';
import { ensureDatabase } from './ensure-database.js';
import { ensureTables } from '../setup.js';
import { todayISO } from '../../shared/dateformat.js';

const line = '='.repeat(60);

async function getOrCreateUser(username, defaults, password) {
  let user = await User.findOne({ where: { username } });
  if (user && user.username === username) return [user, false];
  user = await User.create({ username, ...defaults, password: await makePassword(password), date_joined: new Date() });
  return [user, true];
}

async function populate() {
  console.log(line);
  console.log('SEEDING DATABASE: Users, Event (Prarambh), Volunteer & Certificate');
  console.log(line);

  const [admin, createdAdmin] = await getOrCreateUser(
    'admin',
    { email: 'admin@pehchanyui.in', is_staff: true, is_superuser: true },
    'AdminSecure2026!'
  );
  console.log(createdAdmin ? "[+] Admin user 'admin' created." : "[*] Admin user 'admin' already exists.");

  const [, createdUser] = await getOrCreateUser(
    'rahul_sharma',
    { email: 'rahul.sharma@example.com', first_name: 'Rahul', last_name: 'Sharma', is_staff: false, is_superuser: false },
    'UserPehchan2026!'
  );
  console.log(createdUser ? "[+] Regular user 'rahul_sharma' created (Password: UserPehchan2026!)." : "[*] User 'rahul_sharma' already exists.");

  const [volunteerUser, createdVol] = await getOrCreateUser(
    'priya_volunteer',
    { email: 'priya.patel@example.com', first_name: 'Priya', last_name: 'Patel', is_staff: false, is_superuser: false },
    'VolunteerPehchan2026!'
  );
  console.log(
    createdVol ? "[+] Volunteer user 'priya_volunteer' created (Password: VolunteerPehchan2026!)." : "[*] Volunteer user 'priya_volunteer' already exists."
  );

  const [y, m, d] = todayISO().split('-').map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const description =
    'Prarambh (प्रारंभ) - An empowering community outreach initiative by Pehchan.\n\n' +
    'Schedule: 10:00 AM to 12:00 PM (3-Day Community Drive)\n' +
    'Focus Areas:\n' +
    '• Educational distribution & stationery kits for underprivileged children\n' +
    '• Community learning workshops and fun activities\n' +
    '• Warm food and winter essentials distribution\n\n' +
    'Join us in Navi Mumbai to make a lasting difference in the lives of these bright young minds!';

  let event = await Event.findOne({ where: { name: 'Prarambh' } });
  if (!event) {
    event = await Event.create({
      name: 'Prarambh',
      description,
      event_date: startDate,
      location: 'Navi Mumbai, Maharashtra',
      fundraising_goal: '50000.00',
      is_active: true,
      status: 'upcoming',
      created_by_id: admin.id,
    });
    console.log(`[+] Event 'Prarambh' created for ${startDate} at Navi Mumbai.`);
  } else {
    event.description = description;
    event.location = 'Navi Mumbai, Maharashtra';
    event.event_date = startDate;
    await event.save();
    console.log("[*] Event 'Prarambh' updated with timing (10:00 AM to 12:00 PM) and Navi Mumbai location.");
  }

  let vol = await EventVolunteer.findOne({ where: { user_id: volunteerUser.id, event_id: event.id } });
  if (!vol) {
    vol = await EventVolunteer.create({ user_id: volunteerUser.id, event_id: event.id, contact_number: '9820112233', status: 'approved', attended: true });
    console.log(`[+] Volunteer '${volunteerUser.username}' enrolled and approved for '${event.name}'.`);
  } else {
    Object.assign(vol, { status: 'approved', attended: true, contact_number: '9820112233' });
    await vol.save();
    console.log(`[*] Volunteer '${volunteerUser.username}' record confirmed for '${event.name}'.`);
  }

  const [, createdLt] = await LifetimeVolunteer.findOrCreate({
    where: { user_id: volunteerUser.id },
    defaults: {
      user_id: volunteerUser.id,
      contact_number: '9820112233',
      motivation: 'Dedicated to empowering underprivileged children through continuous grassroots volunteering.',
      status: 'approved',
      reviewed_by_id: admin.id,
    },
  });
  if (createdLt) console.log(`[+] Lifetime volunteer status granted to '${volunteerUser.username}'.`);

  let cert = await Certificate.findOne({ where: { certificate_number: 'VOL-PRARAMBH-2026-001' } });
  if (!cert) {
    cert = await Certificate.create({ certificate_number: 'VOL-PRARAMBH-2026-001', event_id: event.id, volunteer_id: vol.id, issue_date: todayISO() });
    console.log(`[+] Volunteer Certificate '${cert.certificate_number}' issued to '${volunteerUser.username}'.`);
  } else {
    console.log(`[*] Certificate '${cert.certificate_number}' already exists.`);
  }

  console.log(line);
  console.log('DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log(line);
}

try {
  await ensureDatabase();
  await sequelize.authenticate();
  await ensureTables({ log: () => {} });
  await populate();
  await sequelize.close();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
