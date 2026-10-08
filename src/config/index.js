require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
};

if (!config.jwt.secret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set a value.');
}

module.exports = config;
