import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServerInstance = null;

export async function connectDB(uri = config.mongodbUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If uri explicitly points to memory or test, connect directly
  if (uri && !uri.startsWith('mongodb://127.0.0.1:27017') && !uri.startsWith('mongodb://localhost:27017')) {
    await mongoose.connect(uri);
    return mongoose.connection;
  }

  // Attempt to connect to local MongoDB with a 2-second timeout
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[Database] Connected to external MongoDB at ${uri}`);
    return mongoose.connection;
  } catch (err) {
    console.log('[Database] Local MongoDB daemon not reachable (ECONNREFUSED).');
    console.log('[Database] Initializing embedded in-memory MongoDB server for demo...');

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create();
    const memoryUri = memoryServerInstance.getUri();

    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to in-memory MongoDB at ${memoryUri}`);

    // Automatically seed data for demo demonstration
    try {
      const { seedDatabase } = await import('../../scripts/seed.js');
      await seedDatabase(memoryUri);
      console.log('[Database] In-memory database auto-seeded with test users, briefs, decisions & tasks!');
    } catch (seedErr) {
      console.warn('[Database] Auto-seed warning:', seedErr.message);
    }

    return mongoose.connection;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
}
