const User = require("../Model/User");
//display part
const getAllUsers = async (req,res,next)=>{

    let users;

    try{// return database
        users = await User.find();
    }catch(err){
        console.log(err);
    }
    //not found
    if(!users){
        return res.status(404).json({message:"Users are not found"});
    }
    //display all users 
    return res.status(200).json({users});
};
//data insert
const bcrypt = require("bcryptjs");

const addUsers = async(req,res,next)=>{
  try {
    let { name = "", email = "", password = "", contact_no = "", role, isActive } = req.body || {};

    name = String(name).trim();
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, role are required." });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hash = await bcrypt.hash(password, 10);

    const users = new User({
      name,
      email,
      password: hash,
      contact_no,
      role,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    await users.save();
    const publicUser = users.toObject();
    delete publicUser.password;

    return res.status(201).json({ user: publicUser });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "unable to add Users" });
  }
};
//retrieve data Get by Id
const getById = async(req,res,next)=>{

    const id = req.params.id;

    let users;

    try{
       users = await User.findById(id);
    }catch(err){
        console.log(err);
    }
      //not available dentist
    if(!users){
        return res.status(404).json({message:"User not found"});

    }
    return res.status(200).json({ users });

};

// PUT /users/:id  (update name/email/contact_no/password)
const updateById = async (req, res) => {
  try {
    console.log("Update request received:", req.params, req.body);
    const { id } = req.params;
    const { name, email, contact_no, password } = req.body || {};

    const $set = {};
    if (typeof name !== "undefined") $set.name = String(name).trim();
    if (typeof email !== "undefined") $set.email = String(email).trim().toLowerCase();
    if (typeof contact_no !== "undefined") $set.contact_no = contact_no;
    if (typeof password !== "undefined") {
      const bcrypt = require("bcryptjs");
      $set.password = await bcrypt.hash(String(password), 10);
    }
    
    console.log("Fields to update:", $set);
    
    if (Object.keys($set).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // Check if email is already taken by another user
    if ($set.email) {
      const existingUser = await User.findOne({ email: $set.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }

    const user = await User.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    console.log("User updated successfully:", user.name, user.email);
    return res.status(200).json({ user });
  } catch (err) {
    console.error("Update user error:", err);
    return res.status(500).json({ message: "Unable to update user: " + err.message });
  }
};


exports.getAllUsers=getAllUsers;
exports.addUsers= addUsers;
exports.getById= getById;
exports.updateById = updateById;
