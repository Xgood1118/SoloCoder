const { pool: db } = require('../config/database');

class Menu {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM menus ORDER BY parent_id, sort_order');
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM menus WHERE id = ?', [id]);
    return rows[0];
  }

  static async create({ parent_id, name, path, icon, sort_order }) {
    const [result] = await db.query(
      'INSERT INTO menus (parent_id, name, path, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
      [parent_id || 0, name, path, icon, sort_order || 0]
    );
    return result.insertId;
  }

  static async update(id, { parent_id, name, path, icon, sort_order }) {
    await db.query(
      'UPDATE menus SET parent_id = ?, name = ?, path = ?, icon = ?, sort_order = ? WHERE id = ?',
      [parent_id || 0, name, path, icon, sort_order || 0, id]
    );
  }

  static async delete(id) {
    await db.query('DELETE FROM menus WHERE id = ?', [id]);
  }

  static async getByRoleId(roleId) {
    const [rows] = await db.query(
      `SELECT DISTINCT m.* FROM menus m 
       INNER JOIN role_menus rm ON m.id = rm.menu_id 
       WHERE rm.role_id = ? 
       ORDER BY m.parent_id, m.sort_order`,
      [roleId]
    );
    return rows;
  }

  static buildTree(menus, parentId = 0) {
    return menus
      .filter(menu => menu.parent_id === parentId)
      .map(menu => ({
        ...menu,
        children: Menu.buildTree(menus, menu.id)
      }));
  }
}

module.exports = Menu;
