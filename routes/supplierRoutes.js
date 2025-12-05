const express = require('express');
const supplierController = require('../controllers/supplierController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['manager']));

router.get('/', supplierController.getAllSuppliers);
router.post('/', supplierController.createSupplier);

module.exports = router;
