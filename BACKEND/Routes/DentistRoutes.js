const express = require("express");
const router = express.Router();
const dentistController = require("../Controllers/DentistControllers");

router.post("/", dentistController.addDentist);
router.get("/", dentistController.getAllDentists);
router.get("/:id", dentistController.getById);
router.get("/code/:code", dentistController.getByCode);
router.put("/:id", dentistController.updateDentist);
router.put("/code/:code", dentistController.updateDentistByCode);
router.delete("/:id", dentistController.deleteDentist);

module.exports = router;
