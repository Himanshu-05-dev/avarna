import 'dotenv/config';
import app from './src/app/app.js';
import { connectToDb } from './src/config/db.js';
import { config } from './src/config/config.js';

connectToDb()
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Server is running on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });