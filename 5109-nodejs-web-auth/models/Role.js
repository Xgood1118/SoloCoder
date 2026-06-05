const { pool: db } = require('../config/database');

class Role {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM roles ORDER BY id');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM roles WHERE id = ?', [id]);
    return rows[0];
  }

  static async create({ name, description, data_scope }) {
    const [result] = await db.query(
      'INSERT INTO roles (name, description, data_scope) VALUES (?, ?, ?)',
      [name, description, data_scope || 'self']
    );
    return result.insertId;
  }

  static async update(id, { name, description, data_scope }) {
    await db.query(
      'UPDATE roles SET name = ?, description = ?, data_scope = ? WHERE id = ?',
      [name, description, data_scope, id]
    );
  }

  static async delete(id) {
    await db.query('DELETE FROM roles WHERE id = ?', [id]);
  }

  static async getMenus(roleId) {
    const [rows] = await db.query(
      `SELECT m.* FROM menus m 
       INNER JOIN role_menus rm ON m.id = rm.menu_id 
       WHERE rm.role_id = ? 
       ORDER BY m.parent_id, m.sort_order`,
      [roleId]
    );
    return rows;
  }

  static async assignMenus(roleId, menuIds) {
    await db.query('DELETE FROM role_menus WHERE role_id = ?', [roleId]);
    if (menuIds && menuIds.length > 0) {
      const values = menuIds.map(menuId => [roleId, menuId]);
      await db.query('INSERT INTO role_menus (role_id, menu_id) VALUES ?', [values]);
    }
  }
}

module.exports = Role;
