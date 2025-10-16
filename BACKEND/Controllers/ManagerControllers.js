const Manager = require("../Model/ManagerModel")

const getAllManagers = async(req , res , next) => {

    let managers ;

    //get all users
    try{
        managers = await Manager.find();
    }catch(err){
        console.log(err);
    }
    //not any users found
    if(!managers){
        return res.status(404).json({message :"User Not Found"})
    }

    //Display all users
    return res.status(200).json({managers});
};
const addManagers = async(req,res,next)=>{

    const {userId,department} = req.body;

    let managers;

    try{
        
        managers = new Manager({userId,department});
        //to save in database
        await managers.save();

    return res.status(201).json({ managers });
    } catch (err) {
    console.error("addManagers error:", err);

    // common duplicate key: nic or generated patientCode
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Duplicate key", detail: err.keyValue });
    }
    return res.status(422).json({ message: err.message || "Unable to add manager" });
  };
};


const getById = async(req , res , next) => {
    try {
    const { id } = req.manager; // assuming JWT auth
    const manager = await Manager.findById(id);
    if (!manager) return res.status(404).json({ message: "Manager not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

};
const getByCode = async (req, res) => {
  try {
    const { managerCode } = req.params;
    const manager = await Manager.findOne({ managerCode }).lean();
    if (!manager) return res.status(404).json({ message: "Manager not found" });
    return res.status(200).json({ manager });
  } catch (err) {
    console.error("getByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllManagers = getAllManagers ;
exports.addManagers = addManagers ;
exports.getById = getById ;
exports.getByCode =getByCode ;
