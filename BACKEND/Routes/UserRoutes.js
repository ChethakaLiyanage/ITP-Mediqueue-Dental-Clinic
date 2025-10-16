const express = require("express");
const User_router =express.Router();
//insert model
const User = require("../Model/User");
//insert controller
const UserController = require("../Controllers/UserControllers");

User_router.get("/",UserController.getAllUsers);
User_router.post("/",UserController.addUsers);
User_router.get("/:id",UserController.getById)
User_router.put("/:id",UserController.updateById)


//export
module.exports = User_router;