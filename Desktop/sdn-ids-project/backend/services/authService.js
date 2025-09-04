import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './database.js';
import config from './config.js';

// Password hashing configuration
const SALT_ROUNDS = config.security.bcrypt.saltRounds;

// User registration
export async function registerUser(userData) {
  try {
    const { username, email, password, full_name, role = 'viewer' } = userData;

    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const validRoles = ['admin', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be admin, analyst, or viewer');
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, email, full_name, role, status, created_at`,
      [username, email, passwordHash, full_name, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
        created_at: user.created_at
      },
      token
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: error.message };
  }
}

// User login
export async function loginUser(credentials) {
  try {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      throw new Error(`Account is ${user.status}. Please contact administrator.`);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid username or password');
    }

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken(user);

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
        last_login: user.last_login
      },
      token
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
}

// User logout (no server state to clear)
export async function logoutUser(userId) {
  try {
    return { success: true, message: 'Logout successful' };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, message: error.message };
  }
}

// Verify JWT token
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.security.jwt.secret);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status
  };
  return jwt.sign(payload, config.security.jwt.secret, {
    expiresIn: config.security.jwt.expiresIn
  });
}

// Get user by ID
export async function getUserById(userId) {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, status, last_login, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(userId, updateData) {
  try {
    const allowedFields = ['full_name', 'email'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [field, value] of Object.entries(updateData)) {
      if (allowedFields.includes(field) && value !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING id, username, email, full_name, role, status, last_login, created_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return { success: true, message: 'Profile updated successfully', user: result.rows[0] };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, message: error.message };
  }
}

// Change password
export async function changePassword(userId, currentPassword, newPassword) {
  try {
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    console.error('Password change error:', error);
    return { success: false, message: error.message };
  }
}

// Get all users (admin only)
export async function getAllUsers() {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, status, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    return { success: true, users: result.rows };
  } catch (error) {
    console.error('Error getting all users:', error);
    return { success: false, message: error.message };
  }
}

// Update user status (admin only)
export async function updateUserStatus(userId, status) {
  try {
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be active, inactive, or suspended');
    }

    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, email, status',
      [status, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return { success: true, message: 'User status updated successfully', user: result.rows[0] };
  } catch (error) {
    console.error('Status update error:', error);
    return { success: false, message: error.message };
  }
}
