const { pool: db } = require('../config/database');

class Customer {
  static async findAllWithDataScope(userId, teamId, dataScope) {
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (dataScope === 'self') {
      sql += ' AND owner_id = ?';
      params.push(userId);
    } else if (dataScope === 'team') {
      sql += ' AND team_id = ?';
      params.push(teamId);
    }

    sql += ' ORDER BY id DESC';

    const [rows] = await db.query(sql, params);
    return rows;
  }

  static async findByIdWithPermission(customerId, userId, teamId, dataScope) {
    let sql = 'SELECT * FROM customers WHERE id = ?';
    const params = [customerId];

    if (dataScope === 'self') {
      sql += ' AND owner_id = ?';
      params.push(userId);
    } else if (dataScope === 'team') {
      sql += ' AND team_id = ?';
      params.push(teamId);
    }

    const [rows] = await db.query(sql, params);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0];
  }

  static async create({ name, phone, email, company, owner_id, team_id }) {
    const [result] = await db.query(
      'INSERT INTO customers (name, phone, email, company, owner_id, team_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, phone, email, company, owner_id, team_id]
    );
    return result.insertId;
  }

  static async update(id, { name, phone, email, company }) {
    await db.query(
      'UPDATE customers SET name = ?, phone = ?, email = ?, company = ? WHERE id = ?',
      [name, phone, email, company, id]
    );
  }

  static async delete(id) {
    await db.query('DELETE FROM customers WHERE id = ?', [id]);
  }

  static async checkOwnership(customerId, userId) {
    const [rows] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND owner_id = ?',
      [customerId, userId]
    );
    return rows.length > 0;
  }

  static async checkTeamAccess(customerId, teamId) {
    const [rows] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND team_id = ?',
      [customerId, teamId]
    );
    return rows.length > 0;
  }
}

module.exports = Customer;
