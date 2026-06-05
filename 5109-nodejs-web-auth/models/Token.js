const { pool: db } = require('../config/database');
const jwt = require('jsonwebtoken');

class Token {
  static generateAccessToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN
    });
  }

  static generateRefreshToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN
    });
  }

  static async saveRefreshToken(userId, refreshToken) {
    const decoded = jwt.decode(refreshToken);
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid refresh token: missing exp claim');
    }
    const expiresAt = new Date(decoded.exp * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, refreshToken, expiresAt]
    );
  }

  static async findRefreshToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ?',
      [token]
    );
    return rows[0];
  }

  static async deleteRefreshToken(token) {
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  static async deleteByUserId(userId) {
    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }

  static async deleteExpiredTokens() {
    await db.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  }
}

module.exports = Token;
