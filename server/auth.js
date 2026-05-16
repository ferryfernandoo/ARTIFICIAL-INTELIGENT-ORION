import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { userDb } from './database.js';

// Configure Local Strategy (email + password)
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = userDb.findByEmail(email.toLowerCase().trim());

        if (!user) {
          // Distinguish between "user not found" and "wrong password"
          return done(null, false, { message: 'Username tidak ditemukan', code: 'USER_NOT_FOUND' });
        }

        if (!user.password) {
          return done(null, false, { message: 'Akun ini tidak memiliki password. Silakan hubungi support.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          // Distinguish between "user not found" and "wrong password"
          return done(null, false, { message: 'Password salah', code: 'WRONG_PASSWORD' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user
passport.deserializeUser((id, done) => {
  try {
    const user = userDb.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Hash password helper
export const hashPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

export default passport;
