const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const AppError = require('../utils/AppError');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at, updated_at: u.updated_at });

// Pre-computed hash so login takes similar time whether or not the email exists (avoids user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password', config.bcryptRounds);

exports.register = async (req, res) => {
  const { name, email, password } = req.valid.body;

  const existing = await db('users').where({ email }).first();
  if (existing) throw new AppError(409, 'Email is already registered');

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  // Role is never taken from the request: public registration always creates a regular user.
  let user;
  try {
    [user] = await db('users').insert({ name, email, password: hash, role: 'user' }).returning('*');
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'Email is already registered'); // race on unique index
    throw err;
  }

  res.status(201).json({ success: true, message: 'Registered successfully', data: { user: publicUser(user), token: signToken(user) } });
};

exports.login = async (req, res) => {
  const { email, password } = req.valid.body;

  const user = await db('users').where({ email }).first();
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');

  res.json({ success: true, message: 'Login successful', data: { user: publicUser(user), token: signToken(user) } });
};

exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });
