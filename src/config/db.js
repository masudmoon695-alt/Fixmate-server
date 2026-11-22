import { MongoClient } from 'mongodb';

const DB_NAME = process.env.DB_NAME || 'fixmate';

let client = null;
let clientPromise = null;
let db = null;

export function isDbConnected() {
  return db !== null;
}

export function getDb() {
  if (!db) {
    const error = new Error('Database is not connected. Set MONGODB_URI and restart the server.');
    error.statusCode = 503;
    throw error;
  }
  return db;
}

export const collections = {
  users: () => getDb().collection('users'),
  services: () => getDb().collection('services'),
  bookings: () => getDb().collection('bookings'),
  payments: () => getDb().collection('payments'),
};

async function ensureIndexes(database) {
  const services = database.collection('services');
  const bookings = database.collection('bookings');
  const payments = database.collection('payments');

  await Promise.all([
    services.createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 }),
    services.createIndex({ technicianEmail: 1 }),
    bookings.createIndex({ customerEmail: 1 }),
    bookings.createIndex({ technicianEmail: 1 }),
    bookings.createIndex({ serviceId: 1 }),
    payments.createIndex({ stripeSessionId: 1 }, { unique: true }),
    payments.createIndex({ bookingId: 1 }, { unique: true }),
  ]);
}

/**
 * Cached, serverless-safe connection. A failed attempt is not cached forever,
 * so the next call retries instead of returning the same rejected promise.
 */
export async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI is not set — API is running without a database.');
    return null;
  }

  if (!clientPromise) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      client = null;
      throw error;
    });
  }

  const connected = await clientPromise;
  db = connected.db(DB_NAME);
  await ensureIndexes(db);
  console.log(`[db] connected to "${DB_NAME}"`);
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
  }
  client = null;
  clientPromise = null;
  db = null;
}
