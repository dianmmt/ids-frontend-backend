import express from 'express';
import { registerUser, loginUser, logoutUser, getUserById, updateUserProfile, changePassword, getAllUsers, updateUserStatus } from '../services/authService.js';
import { verifyToken } from '../services/authService.js';
import { query } from '../services/database.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  const tokenResult = verifyToken(token);
  if (!tokenResult.valid) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }

  req.user = tokenResult.user;
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string') {
    const parts = xfwd.split(',');
    if (parts.length > 0) return parts[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

// User registration (role selection allowed for viewer/analyst only)
router.post('/register', async (req, res) => {
  try {
    // Allow only 'viewer' or 'analyst' via registration; force to 'viewer' if anything else
    const allowedRoles = ['viewer', 'analyst'];
    const requestedRole = typeof req.body.role === 'string' ? req.body.role : 'viewer';
    const role = allowedRoles.includes(requestedRole) ? requestedRole : 'viewer';

    const userData = {
      ...req.body,
      role
    };
    
    const result = await registerUser(userData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during registration' 
    });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body);
    
    if (result.success && result.user) {
      // Audit log: LOGIN
      try {
        await query(
          `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, action_time)
           VALUES ($1, $2, 'LOGIN', 'auth', NULL, NULL, $3::jsonb, $4, $5, CURRENT_TIMESTAMP)`,
          [
            result.user.id,
            result.user.username,
            JSON.stringify({ status: 'success' }),
            getClientIp(req),
            req.headers['user-agent'] || null
          ]
        );
      } catch (e) {
        console.error('Audit log (login) error:', e);
      }
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during login' 
    });
  }
});

// User logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const result = await logoutUser(req.user.id);

    // Audit log: LOGOUT
    try {
      await query(
        `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, action_time)
         VALUES ($1, $2, 'LOGOUT', 'auth', NULL, NULL, $3::jsonb, $4, $5, CURRENT_TIMESTAMP)`,
        [
          req.user.id,
          req.user.username,
          JSON.stringify({ status: result.success ? 'success' : 'failed' }),
          getClientIp(req),
          req.headers['user-agent'] || null
        ]
      );
    } catch (e) {
      console.error('Audit log (logout) error:', e);
    }

    res.json(result);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error during logout' 
    });
  }
});

// Verify token
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (user) {
      res.json({ 
        valid: true, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          status: user.status,
          last_login: user.last_login,
          created_at: user.created_at
        }
      });
    } else {
      res.status(404).json({ valid: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ valid: false, message: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (user) {
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          status: user.status,
          last_login: user.last_login,
          created_at: user.created_at
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await updateUserProfile(req.user.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await getAllUsers();
    res.json(result);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update user status (admin only)
router.put('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body || {};

    // Validate input early to avoid DB errors
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be active, inactive, or suspended' });
    }

    const result = await updateUserStatus(userId, status);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('User status update error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: Create user (any role)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await registerUser(req.body);
    // Do not auto-login newly created user for admin-created accounts
    if (result.success) {
      delete result.token;
    }
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: Update user (email, full_name, role, status)
router.put('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, full_name, role, status } = req.body;

    // Build dynamic update
    const fields = [];
    const values = [];
    let idx = 1;
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(full_name); }
    if (role !== undefined) { fields.push(`role = $${idx++}`); values.push(role); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(userId);
    const update = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, username, email, full_name, role, status, last_login, created_at`,
      values
    );

    if (update.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: update.rows[0], message: 'User updated successfully' });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: Delete user
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username, email', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Session info (last login from audit_logs and session duration)
router.get('/session-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the most recent LOGIN for this user
    const loginRes = await query(
      `SELECT action_time FROM audit_logs 
       WHERE user_id = $1 AND action = 'LOGIN' 
       ORDER BY action_time DESC 
       LIMIT 1`,
      [userId]
    );

    if (loginRes.rows.length === 0) {
      return res.json({
        success: true,
        last_login: null,
        session_seconds: 0
      });
    }

    const lastLoginTime = new Date(loginRes.rows[0].action_time);

    // Find the most recent LOGOUT after that LOGIN (if any)
    const logoutRes = await query(
      `SELECT action_time FROM audit_logs 
       WHERE user_id = $1 AND action = 'LOGOUT' AND action_time >= $2 
       ORDER BY action_time DESC 
       LIMIT 1`,
      [userId, lastLoginTime]
    );

    let sessionSeconds = 0;
    if (logoutRes.rows.length > 0) {
      sessionSeconds = Math.max(0, Math.round((new Date(logoutRes.rows[0].action_time).getTime() - lastLoginTime.getTime()) / 1000));
    } else {
      sessionSeconds = Math.max(0, Math.round((Date.now() - lastLoginTime.getTime()) / 1000));
    }

    res.json({
      success: true,
      last_login: lastLoginTime.toISOString(),
      session_seconds: sessionSeconds
    });
  } catch (error) {
    console.error('Session info error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
