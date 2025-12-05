// src/controllers/inventoryController.js

const { pool } = require('../config/database');

const inventoryController = {
  // Thống kê tồn kho hiện tại
  getCurrentInventory: async (req, res) => {
    try {
      const { 
        search,
        page = 1,
        limit = 20
      } = req.query;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (search) {
        whereClause += ' AND (p.sku LIKE ? OR p.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Query chính
      let query = `
        SELECT 
          p.product_id,
          p.sku,
          p.name as product_name,
          p.stock_quantity,
          p.price,
          COALESCE(p.cost_price, 0) as cost_price,
          (p.stock_quantity * COALESCE(p.cost_price, 0)) as inventory_value,
          CASE
            WHEN p.stock_quantity = 0 THEN 'out_of_stock'
            WHEN p.stock_quantity < 10 THEN 'low'
            WHEN p.stock_quantity >= 10 AND p.stock_quantity < 50 THEN 'normal'
            ELSE 'high'
          END as stock_status
        FROM products p
        ${whereClause}
        ORDER BY p.stock_quantity ASC 
        LIMIT ${limitNum} OFFSET ${offset}
      `;

      const [products] = await pool.execute(query, params);

      // Đếm tổng số
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        ${whereClause}
      `;
      const [countResult] = await pool.execute(countQuery, params);

      // Tính tổng giá trị tồn kho - SỬA: Thêm COALESCE để tránh NULL
      const [summary] = await pool.execute(`
        SELECT 
          COUNT(*) as total_products,
          SUM(stock_quantity) as total_quantity,
          COALESCE(SUM(stock_quantity * COALESCE(cost_price, 0)), 0) as total_inventory_value,
          COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_count,
          COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity < 10 THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN stock_quantity >= 10 AND stock_quantity < 50 THEN 1 END) as normal_stock_count,
          COUNT(CASE WHEN stock_quantity >= 50 THEN 1 END) as high_stock_count
        FROM products
      `);

      res.json({
        success: true,
        data: {
          products,
          summary: summary[0],
          pagination: {
            current_page: pageNum,
            limit: limitNum,
            total: countResult[0].total,
            total_pages: Math.ceil(countResult[0].total / limitNum)
          }
        }
      });
    } catch (error) {
      console.error('Get current inventory error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy thống kê tồn kho'
      });
    }
  },

  // Thống kê tồn kho tính đến ngày
  getInventoryByDate: async (req, res) => {
    try {
      const { date, search, page = 1, limit = 20 } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ngày cần thống kê (date)'
        });
      }

      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;

      let searchClause = '';
      const searchParams = [];
      if (search) {
        searchClause = 'AND (p.sku LIKE ? OR p.name LIKE ?)';
        searchParams.push(`%${search}%`, `%${search}%`);
      }

      // 1. Lấy danh sách sản phẩm + tồn kho tại ngày
      const productQuery = `
        SELECT 
          p.product_id,
          p.sku,
          p.name AS product_name,
          p.price,
          COALESCE(p.cost_price, 0) AS cost_price,
          COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) AS stock_quantity,
          (COALESCE(p.cost_price, 0) * (COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0))) AS inventory_value
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS total_in
          FROM stock_in_items sii
          JOIN stock_in_orders sio ON sii.stock_in_order_id = sio.stock_in_order_id
          WHERE sio.status = 'confirmed' AND DATE(sio.created_at) <= ?
          GROUP BY product_id
        ) stock_in ON p.product_id = stock_in.product_id
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS total_out
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.order_id
          WHERE o.order_status IN ('completed', 'confirmed') AND DATE(o.created_at) <= ?
          GROUP BY product_id
        ) stock_out ON p.product_id = stock_out.product_id
        WHERE 1=1 ${searchClause}
        ORDER BY stock_quantity ASC
        LIMIT ${limitNum} OFFSET ${offset}
      `;

      const productParams = [date, date, ...searchParams];
      const [products] = await pool.execute(productQuery, productParams);

      // 2. Đếm tổng số bản ghi (cho phân trang)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        WHERE 1=1 ${searchClause}
      `;
      const [countResult] = await pool.execute(countQuery, searchParams);

      // 3. Tính summary (tổng hợp toàn bộ, không phân trang)
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_products,
          SUM(COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0)) as total_quantity,
          SUM(COALESCE(p.cost_price, 0) * (COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0))) as total_inventory_value,
          COUNT(CASE WHEN COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) = 0 THEN 1 END) as out_of_stock_count,
          COUNT(CASE WHEN COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) > 0 AND COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) < 10 THEN 1 END) as low_stock_count,
          COUNT(CASE WHEN COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) >= 10 AND COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) < 50 THEN 1 END) as normal_stock_count,
          COUNT(CASE WHEN COALESCE(stock_in.total_in, 0) - COALESCE(stock_out.total_out, 0) >= 50 THEN 1 END) as high_stock_count
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS total_in
          FROM stock_in_items sii
          JOIN stock_in_orders sio ON sii.stock_in_order_id = sio.stock_in_order_id
          WHERE sio.status = 'confirmed' AND DATE(sio.created_at) <= ?
          GROUP BY product_id
        ) stock_in ON p.product_id = stock_in.product_id
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS total_out
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.order_id
          WHERE o.order_status IN ('completed', 'confirmed') AND DATE(o.created_at) <= ?
          GROUP BY product_id
        ) stock_out ON p.product_id = stock_out.product_id
      `;

      const [summaryResult] = await pool.execute(summaryQuery, [date, date]);
      const summary = summaryResult[0];

      // 4. Thêm stock_status cho từng sản phẩm (frontend cần)
      const productsWithStatus = products.map(p => {
        const qty = Number(p.stock_quantity) || 0;
        return {
          ...p,
          stock_quantity: qty,
          inventory_value: Number(p.inventory_value) || 0,
          stock_status: qty === 0 ? 'out_of_stock' :
                        qty < 10 ? 'low' :
                        qty < 50 ? 'normal' : 'high'
        };
      });

      res.json({
        success: true,
        data: {
          products: productsWithStatus,
          summary,
          as_of_date: date,
          pagination: {
            current_page: pageNum,
            limit: limitNum,
            total: countResult[0].total,
            total_pages: Math.ceil(countResult[0].total / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Get inventory by date error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi thống kê tồn kho theo ngày'
      });
    }
  },

  // Thống kê sản phẩm sắp hết hàng
  getLowStock: async (req, res) => {
    try {
      const { threshold = 10 } = req.query;

      const [products] = await pool.execute(`
        SELECT 
          p.product_id,
          p.sku,
          p.name as product_name,
          p.stock_quantity,
          p.price,
          p.cost_price,
          CASE
            WHEN p.stock_quantity = 0 THEN 'Hết hàng'
            WHEN p.stock_quantity < ? THEN 'Sắp hết'
            ELSE 'Bình thường'
          END as status
        FROM products p
        WHERE p.stock_quantity < ?
        ORDER BY p.stock_quantity ASC
      `, [threshold, threshold]);

      res.json({
        success: true,
        data: {
          products,
          total: products.length,
          threshold
        }
      });
    } catch (error) {
      console.error('Get low stock error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách sản phẩm sắp hết hàng'
      });
    }
  },

  // Lịch sử xuất nhập kho của sản phẩm
  getProductInventoryHistory: async (req, res) => {
    try {
      const { product_id } = req.params;
      const { date_from, date_to, page = 1, limit = 20 } = req.query;

      let whereClause = '';
      const params = [];

      if (date_from) {
        whereClause += ' AND DATE(transaction_date) >= ?';
        params.push(date_from);
      }

      if (date_to) {
        whereClause += ' AND DATE(transaction_date) <= ?';
        params.push(date_to);
      }

      const limitNum = parseInt(limit) || 20;
      const offset = (parseInt(page) - 1) * limitNum;

      // Lấy thông tin sản phẩm
      const [product] = await pool.execute(
        'SELECT product_id, sku, name, stock_quantity FROM products WHERE product_id = ?',
        [product_id]
      );

      if (product.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sản phẩm'
        });
      }

      // Lịch sử nhập hàng
      const stockInQuery = `
        SELECT 
          'stock_in' as type,
          sii.quantity,
          sii.unit_cost as price,
          sio.created_at as transaction_date,
          sio.stock_in_order_id as reference_id,
          'Nhập kho' as note,
          u.full_name as created_by_name
        FROM stock_in_items sii
        JOIN stock_in_orders sio ON sii.stock_in_order_id = sio.stock_in_order_id
        LEFT JOIN users u ON sio.created_by = u.user_id
        WHERE sii.product_id = ? AND sio.status = 'confirmed'
        ${whereClause}
      `;

      // Lịch sử bán hàng
      const orderQuery = `
        SELECT 
          'order' as type,
          oi.quantity * -1 as quantity,
          oi.unit_price as price,
          o.created_at as transaction_date,
          o.order_id as reference_id,
          CONCAT('Đơn hàng #', o.order_id) as note,
          u.full_name as created_by_name
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        LEFT JOIN users u ON o.created_by = u.user_id
        WHERE oi.product_id = ? AND o.order_status IN ('completed', 'confirmed')
        ${whereClause}
      `;

      // Kết hợp 2 query và sắp xếp
      const combinedQuery = `
        (${stockInQuery})
        UNION ALL
        (${orderQuery})
        ORDER BY transaction_date DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;

      const queryParams = [product_id, ...params, product_id, ...params];
      const [transactions] = await pool.execute(combinedQuery, queryParams);

      res.json({
        success: true,
        data: {
          product: product[0],
          transactions,
          pagination: {
            current_page: parseInt(page),
            limit: limitNum
          }
        }
      });
    } catch (error) {
      console.error('Get product inventory history error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy lịch sử xuất nhập kho'
      });
    }
  }
};

module.exports = inventoryController;