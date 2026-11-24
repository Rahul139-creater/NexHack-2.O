import { createApp } from './app.js';
import { connectDB } from './db.js';
import { config } from './config.js';

async function startServer() {
  try {
    await connectDB(config.mongodbUri);
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);

    const app = createApp();
    app.listen(config.port, () => {
      console.log(`Team KB Harness Server listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
