const express = require("express");
const router = express.Router();

const Receptionist = require("../Model/ReceptionistModel");
const ReceptionistController = require("../Controllers/ReceptionistControllers");

function formatReceptionist(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : doc;
  const user = plain.userId && typeof plain.userId === "object" ? plain.userId : null;
  return {
    _id: plain._id,
    receptionistCode: plain.receptionistCode || null,
    deskNo: plain.deskNo || "",
    userId: user?._id || plain.userId || null,
    user: user
      ? {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          contact_no: user.contact_no,
        }
      : null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
}

router.get("/", ReceptionistController.getAllReceptionists);
router.post("/", ReceptionistController.addReceptionists);

router.get("/by-user/:userId", async (req, res) => {
  try {
    const receptionist = await Receptionist.findOne({ userId: req.params.userId })
      .populate({ path: "userId", select: "name email role contact_no" })
      .lean();

    if (!receptionist) {
      return res.status(404).json({ message: "Receptionist not found" });
    }

    return res.json({ receptionist: formatReceptionist(receptionist) });
  } catch (err) {
    console.error("/receptionist/by-user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/code/:code", ReceptionistController.getByCode);
router.get("/:id", ReceptionistController.getById);
router.put("/:id", ReceptionistController.updateReceptionist);
router.delete("/:id", ReceptionistController.deleteReceptionist);

module.exports = router;
