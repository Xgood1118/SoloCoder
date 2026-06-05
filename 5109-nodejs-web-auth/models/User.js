const { pool: db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async findByAccount(account) {
    if (!account) return null;
    const [rows] = await db.query(
      'SELECT u.*, r.name as role_name, r.data_scope FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = ? OR u.email = ? OR u.phone = ?',
      [account, account, account]
    );
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.query(
      'SELECT u.id, u.username, u.email, u.phone, u.role_id, u.team_id, r.name as role_name, r.data_scope FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [id]
    );
    return rows[0];
  }

  static async create({ username, email, phone, password, role_id = 4, team_id = null }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, phone, password, role_id, team_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username || null, email || null, phone || null, hashedPassword, role_id, team_id]
    );
    return result.insertId;
  }

  static async comparePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async findAll() {
    const [rows] = await db.query(
      'SELECT u.id, u.username, u.email, u.phone, u.role_id, u.team_id, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id'
    );
    return rows;
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    for (const key in data) {
      if (key !== 'password' && data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (data.password) {
      fields.push('password = ?');
      values.push(await bcrypt.hash(data.password, 10));
    }
    if (fields.length === 0) return;
    values.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  static async delete(id) {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = User;
