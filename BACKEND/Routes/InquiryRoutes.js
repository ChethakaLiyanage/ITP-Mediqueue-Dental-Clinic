const express = require("express");
const router = express.Router();
const inquiryController = require("../Controllers/InquiryControllers");

router.post("/", inquiryController.addInquiry);
router.get("/", inquiryController.getAllInquiries);
router.get("/:id", inquiryController.getById);
router.get("/code/:code", inquiryController.getByCode);
router.put("/:id", inquiryController.updateInquiry);
router.delete("/:id", inquiryController.deleteInquiry);

module.exports = router;
