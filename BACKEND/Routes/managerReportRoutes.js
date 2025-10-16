const express = require("express");
const router = express.Router();
const { 
	getOverview, 
	dentistWorkload, 
	inventoryUsage, 
	exportInventoryCsv, 
	exportInventoryPdf,
	exportStockRequestsCsv,
	exportComprehensivePdf
} = require("../Controllers/ReportController");

router.get("/overview", getOverview);
router.get("/dentist-workload", dentistWorkload);
router.get("/inventory-usage", inventoryUsage);
router.get("/inventory.csv", exportInventoryCsv);
router.get("/inventory.pdf", exportInventoryPdf);
router.get("/stock-requests.csv", exportStockRequestsCsv);
router.get("/comprehensive.pdf", exportComprehensivePdf);

module.exports = router;


