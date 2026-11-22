import 'dotenv/config';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { closeDB, collections, connectDB, getDb } from '../config/db.js';
import { savePaymentFromSession } from '../services/paymentService.js';

const scrypt = promisify(scryptCallback);

/**
 * Matches BetterAuth's credential hasher (scrypt, N=16384, r=16, p=1, 64 bytes,
 * "salt:hex" format). If your BetterAuth version uses a different hasher,
 * sign up through the client instead — the upsert below will keep the role.
 */
async function hashPassword(password) {
  const salt = randomBytes(8).toString('hex');
  const key = await scrypt(password.normalize('NFKC'), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${key.toString('hex')}`;
}

const PASSWORD = process.env.SEED_PASSWORD || 'Fixmate@1234';
const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const daysAhead = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const image = (seed) => `https://picsum.photos/seed/fixmate-${seed}/800/600`;

const users = [
  {
    name: 'FixMate Admin',
    email: 'admin@fixmate.com',
    role: 'admin',
    phone: '01700000001',
    area: 'Gulshan, Dhaka',
    bio: 'Platform administrator for FixMate.',
  },
  {
    name: 'Rafiq Hasan',
    email: 'rafiq@fixmate.com',
    role: 'technician',
    phone: '01700000002',
    area: 'Dhanmondi, Dhaka',
    bio: 'AC and refrigerator specialist with 9 years of experience.',
  },
  {
    name: 'Nusrat Jahan',
    email: 'nusrat@fixmate.com',
    role: 'technician',
    phone: '01700000003',
    area: 'Banani, Dhaka',
    bio: 'Smartphone, laptop and TV repair expert.',
  },
  {
    name: 'Tanvir Ahmed',
    email: 'customer@fixmate.com',
    role: 'customer',
    phone: '01700000004',
    area: 'Mirpur, Dhaka',
    bio: '',
  },
  {
    name: 'Sadia Islam',
    email: 'sadia@fixmate.com',
    role: 'customer',
    phone: '01700000005',
    area: 'Uttara, Dhaka',
    bio: '',
  },
];

const services = [
  {
    title: 'Smartphone Screen Replacement',
    category: 'Smartphone',
    description:
      'Cracked or dead display replaced with a quality panel, including touch and digitizer calibration.',
    image: image('phone-screen'),
    basePrice: 79,
    estimatedDuration: '1-2 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'iPhone Battery Replacement',
    category: 'Smartphone',
    description:
      'Battery health restored with a genuine-grade cell, charging port check and full diagnostics included.',
    image: image('phone-battery'),
    basePrice: 49,
    estimatedDuration: '45 minutes',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'Laptop Motherboard Diagnostics',
    category: 'Laptop & PC',
    description:
      'Board-level inspection for no-power and overheating faults, with a written repair estimate before work.',
    image: image('laptop-board'),
    basePrice: 95,
    estimatedDuration: '3-5 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'MacBook Keyboard Replacement',
    category: 'Laptop & PC',
    description:
      'Full keyboard assembly replacement for sticky or dead keys, including backlight and trackpad testing.',
    image: image('macbook-keyboard'),
    basePrice: 129,
    estimatedDuration: '1 day',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'Split AC Servicing & Gas Refill',
    category: 'AC',
    description:
      'Deep coil cleaning, filter wash, gas pressure check and top-up for strong cooling performance.',
    image: image('ac-service'),
    basePrice: 89,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'AC Compressor Repair',
    category: 'AC',
    description:
      'Compressor testing, capacitor replacement and electrical fault repair for units that stopped cooling.',
    image: image('ac-compressor'),
    basePrice: 149,
    estimatedDuration: '3-4 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'Refrigerator Cooling Coil Repair',
    category: 'Refrigerator',
    description:
      'Frost build-up and weak cooling fixed by testing the coil, defrost system and refrigerant charge.',
    image: image('fridge-coil'),
    basePrice: 119,
    estimatedDuration: '3 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'Refrigerator Thermostat Replacement',
    category: 'Refrigerator',
    description:
      'Faulty thermostat swapped out so your fridge holds a stable temperature and stops over-cooling.',
    image: image('fridge-thermostat'),
    basePrice: 65,
    estimatedDuration: '1-2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: '4K TV Panel Diagnosis',
    category: 'TV',
    description:
      'Professional panel and backlight diagnosis for lines, flicker or black-screen faults before replacement.',
    image: image('tv-panel'),
    basePrice: 75,
    estimatedDuration: '2 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'LED TV Backlight Repair',
    category: 'TV',
    description:
      'Backlight strips replaced and power board checked so the picture is bright and evenly lit again.',
    image: image('tv-backlight'),
    basePrice: 99,
    estimatedDuration: '4 hours',
    serviceMode: 'Shop Drop-off',
    serviceArea: 'Banani, Dhaka',
    technicianEmail: 'nusrat@fixmate.com',
  },
  {
    title: 'Washing Machine Drum Repair',
    category: 'Washing Machine',
    description:
      'Noisy or leaking drum repaired with bearing, seal and suspension inspection for smooth spinning.',
    image: image('washer-drum'),
    basePrice: 109,
    estimatedDuration: '3 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'Front-Load Washer Motor Replacement',
    category: 'Washing Machine',
    description:
      'Motor and belt replacement for machines that will not spin, with a full cycle test after fitting.',
    image: image('washer-motor'),
    basePrice: 139,
    estimatedDuration: '1 day',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'Home Electrical Wiring Inspection',
    category: 'Electrical',
    description:
      'Safety-first inspection of breakers, sockets and wiring with a clear report on any fire risks found.',
    image: image('wiring'),
    basePrice: 59,
    estimatedDuration: '2 hours',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
  {
    title: 'Smart Switch & Socket Installation',
    category: 'Electrical',
    description:
      'Two smart switches or sockets installed, paired with your app and tested for safe grounding.',
    image: image('smart-switch'),
    basePrice: 45,
    estimatedDuration: '1 hour',
    serviceMode: 'Home Visit',
    serviceArea: 'Dhanmondi, Dhaka',
    technicianEmail: 'rafiq@fixmate.com',
  },
];

async function seedUsers() {
  const usersCollection = collections.users();
  const accounts = collections.accounts;

  for (const seed of users) {
    const existing = await usersCollection.findOne({ email: seed.email });
    const document = {
      name: seed.name,
      email: seed.email,
      emailVerified: true,
      image: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed.name)}`,
      role: seed.role,
      phone: seed.phone,
      area: seed.area,
      bio: seed.bio,
      updatedAt: now,
    };

    let user = existing;
    if (existing) {
      await usersCollection.updateOne({ _id: existing._id }, { $set: document });
    } else {
      const result = await usersCollection.insertOne({ ...document, createdAt: now });
      user = { ...document, _id: result.insertedId };
    }

    const accountsCollection = getDb().collection('account');
    const passwordHash = await hashPassword(PASSWORD);
    await accountsCollection.updateOne(
      { providerId: 'credential', userId: user._id },
      {
        $set: {
          accountId: user._id.toString(),
          providerId: 'credential',
          userId: user._id,
          password: passwordHash,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    await usersCollection.updateOne({ _id: user._id }, { $set: { updatedAt: now } });
  }

  console.log(`[seed] users ready (${users.length})`);
}

async function seedServices() {
  const servicesCollection = collections.services();
  const usersCollection = collections.users();
  const technicians = {};

  for (const tech of users.filter((user) => user.role === 'technician')) {
    const stored = await usersCollection.findOne({ email: tech.email });
    technicians[tech.email] = stored?.name || tech.name;
  }

  for (let index = 0; index < services.length; index += 1) {
    const service = services[index];
    const result = await servicesCollection.findOneAndUpdate(
      { title: service.title },
      {
        $set: {
          ...service,
          technicianName: technicians[service.technicianEmail] || 'FixMate Technician',
          approvalStatus: 'approved',
          isAvailable: true,
        },
        $setOnInsert: { createdAt: daysAgo(30 - index) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    void result;
  }

  console.log(`[seed] services ready (${services.length})`);
}

async function seedBookings() {
  const servicesCollection = collections.services();
  const bookingsCollection = collections.bookings();

  const scenarios = [
    {
      serviceTitle: 'Smartphone Screen Replacement',
      customerEmail: 'customer@fixmate.com',
      customerName: 'Tanvir Ahmed',
      status: 'requested',
      createdDaysAgo: 1,
      preferredDate: daysAhead(2),
      phone: '01700000004',
      address: 'House 12, Road 4, Mirpur 10, Dhaka',
      problem: 'The screen cracked after a drop and the touch does not respond on the right side.',
      finalAmount: null,
      paid: false,
    },
    {
      serviceTitle: 'Split AC Servicing & Gas Refill',
      customerEmail: 'sadia@fixmate.com',
      customerName: 'Sadia Islam',
      status: 'accepted',
      createdDaysAgo: 2,
      preferredDate: daysAhead(1),
      phone: '01700000005',
      address: 'Flat 5B, Sector 7, Uttara, Dhaka',
      problem: 'The AC is running but the room stays warm and there is water dripping from the indoor unit.',
      finalAmount: null,
      paid: false,
    },
    {
      serviceTitle: 'Laptop Motherboard Diagnostics',
      customerEmail: 'customer@fixmate.com',
      customerName: 'Tanvir Ahmed',
      status: 'in-progress',
      createdDaysAgo: 4,
      preferredDate: daysAhead(0),
      phone: '01700000004',
      address: 'House 12, Road 4, Mirpur 10, Dhaka',
      problem: 'My laptop does not power on at all after a short circuit in the charger last week.',
      finalAmount: null,
      paid: false,
    },
    {
      serviceTitle: '4K TV Panel Diagnosis',
      customerEmail: 'sadia@fixmate.com',
      customerName: 'Sadia Islam',
      status: 'completed',
      createdDaysAgo: 9,
      preferredDate: daysAgo(7),
      phone: '01700000005',
      address: 'Flat 5B, Sector 7, Uttara, Dhaka',
      problem: 'There is a vertical green line on the right side of the TV panel that never goes away.',
      finalAmount: 82,
      paid: false,
    },
    {
      serviceTitle: 'Refrigerator Cooling Coil Repair',
      customerEmail: 'customer@fixmate.com',
      customerName: 'Tanvir Ahmed',
      status: 'completed',
      createdDaysAgo: 16,
      preferredDate: daysAgo(14),
      phone: '01700000004',
      address: 'House 12, Road 4, Mirpur 10, Dhaka',
      problem: 'The freezer works but the lower compartment stays warm and food is spoiling quickly.',
      finalAmount: 124.5,
      paid: true,
    },
    {
      serviceTitle: 'Washing Machine Drum Repair',
      customerEmail: 'sadia@fixmate.com',
      customerName: 'Sadia Islam',
      status: 'completed',
      createdDaysAgo: 24,
      preferredDate: daysAgo(22),
      phone: '01700000005',
      address: 'Flat 5B, Sector 7, Uttara, Dhaka',
      problem: 'The drum makes a loud banging noise during the spin cycle and sometimes leaks water.',
      finalAmount: 115,
      paid: true,
    },
    {
      serviceTitle: 'MacBook Keyboard Replacement',
      customerEmail: 'sadia@fixmate.com',
      customerName: 'Sadia Islam',
      status: 'rejected',
      createdDaysAgo: 11,
      preferredDate: daysAgo(10),
      phone: '01700000005',
      address: 'Flat 5B, Sector 7, Uttara, Dhaka',
      problem: 'Several keys on the keyboard are stuck and the backlight is not working anymore.',
      finalAmount: null,
      paid: false,
    },
    {
      serviceTitle: 'Home Electrical Wiring Inspection',
      customerEmail: 'customer@fixmate.com',
      customerName: 'Tanvir Ahmed',
      status: 'cancelled',
      createdDaysAgo: 6,
      preferredDate: daysAgo(5),
      phone: '01700000004',
      address: 'House 12, Road 4, Mirpur 10, Dhaka',
      problem: 'One breaker keeps tripping whenever the water heater and microwave run at the same time.',
      finalAmount: null,
      paid: false,
    },
  ];

  for (const scenario of scenarios) {
    const service = await servicesCollection.findOne({ title: scenario.serviceTitle });
    if (!service) continue;

    const document = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: scenario.customerName,
      customerEmail: scenario.customerEmail,
      customerPhone: scenario.phone,
      address: scenario.address,
      preferredDate: scenario.preferredDate,
      problemDescription: scenario.problem,
      status: scenario.status,
      finalAmount: scenario.finalAmount ?? service.basePrice,
      paymentStatus: scenario.paid ? 'paid' : 'unpaid',
      createdAt: daysAgo(scenario.createdDaysAgo),
    };

    const existing = await bookingsCollection.findOne({
      serviceId: service._id.toString(),
      customerEmail: scenario.customerEmail,
      status: scenario.status,
    });

    let bookingId = existing?._id;
    if (existing) {
      await bookingsCollection.updateOne({ _id: existing._id }, { $set: document });
    } else {
      const result = await bookingsCollection.insertOne(document);
      bookingId = result.insertedId;
    }

    if (scenario.paid) {
      await savePaymentFromSession({
        id: `seed_session_${bookingId}`,
        payment_status: 'paid',
        payment_intent: `seed_intent_${bookingId}`,
        amount_total: Math.round(document.finalAmount * 100),
        currency: 'usd',
        created: Math.floor(daysAgo(scenario.createdDaysAgo - 2).getTime() / 1000),
        metadata: {
          bookingId: bookingId.toString(),
          customerEmail: scenario.customerEmail,
        },
      });
    }
  }

  console.log(`[seed] bookings ready (${scenarios.length})`);
}

async function main() {
  const db = await connectDB();
  if (!db) {
    console.error('[seed] MONGODB_URI is missing. Add it to .env and try again.');
    process.exitCode = 1;
    return;
  }

  await seedUsers();
  await seedServices();
  await seedBookings();

  console.log('\n[seed] done');
  console.log(`[seed] admin login: admin@fixmate.com / ${PASSWORD}`);
  console.log('[seed] Change the password from the client after your first login.');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDB().catch(() => {});
    process.exit(process.exitCode || 0);
  });
