require('dotenv').config();
const bcrypt = require('bcryptjs');

/**
 * Idempotent: safe to run multiple times. Users are upserted by email;
 * sample tasks are only inserted if the seeded user has none yet.
 */
exports.seed = async (knex) => {
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const userPassword = process.env.SEED_USER_PASSWORD || 'User@123';

  const users = [
    { name: 'Admin User', email: 'admin@example.com', password: await bcrypt.hash(adminPassword, rounds), role: 'admin' },
    { name: 'Regular User', email: 'user@example.com', password: await bcrypt.hash(userPassword, rounds), role: 'user' },
  ];

  await knex('users')
    .insert(users)
    .onConflict('email')
    .merge(['name', 'password', 'role']);

  const admin = await knex('users').where({ email: 'admin@example.com' }).first();
  const user = await knex('users').where({ email: 'user@example.com' }).first();

  const seedTasks = [
    { owner: admin, title: 'Review sprint backlog', description: 'Go through open tickets and prioritise.', status: 'In Progress' },
    { owner: user, title: 'Write API documentation', description: 'Document all endpoints in the README.', status: 'Pending' },
    { owner: user, title: 'Fix login page bug', description: 'Error message not shown on invalid credentials.', status: 'Testing' },
  ];

  for (const t of seedTasks) {
    const [{ count }] = await knex('tasks').where({ user_id: t.owner.id, title: t.title }).count();
    if (Number(count) === 0) {
      await knex('tasks').insert({ user_id: t.owner.id, title: t.title, description: t.description, status: t.status });
    }
  }
};
