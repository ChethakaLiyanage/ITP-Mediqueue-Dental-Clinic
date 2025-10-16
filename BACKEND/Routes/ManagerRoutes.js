const express = require("express");
const manager_router = express.Router();

const manager = require("../Model/ManagerModel")

const managerController = require("../Controllers/ManagerControllers")

manager_router.get("/" , managerController.getAllManagers);
manager_router.get("/:id" , managerController.getById);
manager_router.get("/code/:managerCode", managerController.getByCode);
manager_router.post("/",managerController.addManagers);


module.exports = manager_router ;
