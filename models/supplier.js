const { pool } = require('../config/database'); // chắc chắn bạn đã config pool MySQL

const Supplier = {
  // Lấy tất cả nhà cung cấp
  getAll: async () => {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    return rows;
  },

  // Tạo nhà cung cấp mới
  create: async (name) => {
    const [result] = await pool.query('INSERT INTO suppliers (name) VALUES (?)', [name]);
    return { supplier_id: result.insertId, name };
  }
};

module.exports = Supplier;
