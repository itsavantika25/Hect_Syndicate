import { initSchema, seedDatabase } from './db.js';

initSchema();
seedDatabase();
console.log('Database seeded successfully.');
