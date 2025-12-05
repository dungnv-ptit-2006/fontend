const Supplier = require('../models/supplier');

const supplierController = {
  getAllSuppliers: async (req, res, next) => {
    try {
      const suppliers = await Supplier.getAll();
      res.json({ success: true, data: suppliers });
    } catch (err) {
      next(err);
    }
  },

  createSupplier: async (req, res, next) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Tên nhà cung cấp là bắt buộc' });

      const supplier = await Supplier.create(name.trim());
      res.status(201).json({ success: true, data: supplier });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = supplierController;
