import express from 'express';
import { 
  authRateLimit, 
  authenticateUser,
  refreshUserToken,
  authenticateToken,
  pgDB
} from '../auth/AuthService.js';

const router = express.Router();

// Apply rate limiting to auth routes
router.use(authRateLimit);

// User Registration
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const result = await registerUser({ username, email, password, role });

    // Log registration
    await pgDB.logAction('USER_REGISTERED', result.user.id, {
      resourceType: 'user',
      resourceId: result.user.id.toString(),
      username: result.user.username
    }, req);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// User Login (updated to use authentication view)
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username/email and password are required'
      });
    }

    const result = await authenticateUser(login, password);

    // Handle password change requirement
    if (result.requirePasswordChange) {
      return res.status(200).json({
        success: true,
        requirePasswordChange: true,
        message: 'Password change required',
        user: result.user
      });
    }

    // Log successful login (optional - you may want to implement audit logging)
    // await pgDB.logAction('USER_LOGIN', result.user.id, {
    //   resourceType: 'user',
    //   resourceId: result.user.id.toString(),
    //   username: result.user.username
    // }, req);

    res.json({
      success: true,
      message: 'Login successful',
      access_token: result.tokens.accessToken,
      refresh_token: result.tokens.refreshToken,
      user: result.user
    });
  } catch (error) {
    console.error('Login error:', error);
    
    res.status(401).json({
      success: false,
      error: error.message === 'Invalid credentials' ? 'Invalid username/email or password' : 'Login failed'
    });
  }
});

// Token Refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const result = await refreshUserToken(refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

// User Profile (protected route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await pgDB.query(
      `SELECT id, username, email, role, last_login, created_at, 
              (SELECT COUNT(*) FROM agents WHERE owner_id = $1) as agent_count,
              (SELECT COUNT(*) FROM memories WHERE user_id = $1 AND is_archived = false) as memory_count
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!user.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.rows[0]
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// Update Profile (protected route)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }

      // Check if email is already taken
      const existingEmail = await pgDB.getUserByEmail(email);
      if (existingEmail && existingEmail.id !== userId) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }

      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, username, email, role, updated_at`;

    const result = await pgDB.query(query, values);

    // Log profile update
    await pgDB.logAction('USER_PROFILE_UPDATED', userId, {
      resourceType: 'user',
      resourceId: userId.toString(),
      updatedFields: Object.keys(req.body)
    }, req);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Change Password (protected route)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    // Get current user with password
    const user = await pgDB.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!user.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const { verifyPassword, hashPassword } = await import('../auth/AuthService.js');
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.rows[0].password_hash);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await pgDB.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Log password change
    await pgDB.logAction('USER_PASSWORD_CHANGED', userId, {
      resourceType: 'user',
      resourceId: userId.toString()
    }, req);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// Logout (invalidate refresh token - client-side implementation)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout action
    await pgDB.logAction('USER_LOGOUT', req.user.id, {
      resourceType: 'user',
      resourceId: req.user.id.toString(),
      username: req.user.username
    }, req);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Get User Activity Log (protected route)
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pgDB.query(
      `SELECT action, resource_type, details, ip_address, timestamp
       FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await pgDB.query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        activities: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity'
    });
  }
});

export default router;
