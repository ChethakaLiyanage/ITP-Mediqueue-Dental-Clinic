const InventoryRequest = require("../Model/InventoryRequest");

// Static catalog: item name -> code
const CATALOG = [
  { itemName: "Gloves (latex/nitrile)", itemCode: "GLV" },
  { itemName: "Masks & face shields", itemCode: "MASK" },
  { itemName: "Gauze pads & cotton rolls", itemCode: "GAUZE" },
  { itemName: "Suction tips & saliva ejectors", itemCode: "SUCTION" },
  { itemName: "Disposable syringes & needles", itemCode: "SYR" },
  { itemName: "Anesthetic cartridges", itemCode: "ANESTH" },
  { itemName: "Impression materials (alginate, silicone)", itemCode: "IMPR" },
  { itemName: "Restorative materials", itemCode: "REST" },
  { itemName: "Amalgam, composites, glass ionomer cements", itemCode: "AMAL" },
  { itemName: "Polishing paste & prophy cups", itemCode: "POLISH" },
  { itemName: "Disinfectants & surface cleaners", itemCode: "DISINF" },
  { itemName: "Sterilization pouches & wraps", itemCode: "STERIL" },
];

const byName = new Map(CATALOG.map(i => [i.itemName, i]));
const byCode = new Map(CATALOG.map(i => [i.itemCode, i]));

// GET /inventory/items
const getInventoryItems = async (req, res) => {
  return res.status(200).json({ items: CATALOG });
};

// POST /inventory/requests
// body: { dentistCode: string, items: [{ itemName?: string, itemCode?: string, quantity: number }], notes?: string }
const createInventoryRequest = async (req, res) => {
  try {
    const { dentistCode, items, notes } = req.body || {};

    if (!dentistCode || typeof dentistCode !== "string" || !dentistCode.trim()) {
      return res.status(400).json({ message: "dentistCode is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    const normalized = [];
    for (const raw of items) {
      const q = Number(raw?.quantity);
      if (!Number.isFinite(q) || q < 1) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }

      let catalogEntry = null;
      if (raw.itemCode && byCode.has(String(raw.itemCode).trim())) {
        catalogEntry = byCode.get(String(raw.itemCode).trim());
      } else if (raw.itemName && byName.has(String(raw.itemName).trim())) {
        catalogEntry = byName.get(String(raw.itemName).trim());
      }
      if (!catalogEntry) {
        return res.status(400).json({ message: `Unknown item: ${raw.itemName || raw.itemCode}` });
      }

      normalized.push({
        itemName: catalogEntry.itemName,
        itemCode: catalogEntry.itemCode,
        quantity: q,
      });
    }

    const doc = new InventoryRequest({ dentistCode: String(dentistCode).trim(), items: normalized, notes });
    await doc.save();
    return res.status(201).json({ request: doc });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /inventory/requests?dentistCode=Dr-0001
const listInventoryRequests = async (req, res) => {
  try {
    const { dentistCode } = req.query;
    const filter = {};
    if (dentistCode) filter.dentistCode = String(dentistCode).trim();
    const requests = await InventoryRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ count: requests.length, requests });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /inventory/requests/:id/status
// body: { status: "Approved" | "Rejected" | "Fulfilled" }
const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Request ID is required" });
    }

    if (!["Approved", "Rejected", "Fulfilled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const request = await InventoryRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Only allow status updates for pending requests
    if (request.status !== "Pending") {
      return res.status(400).json({ 
        message: `Cannot update status from ${request.status} to ${status}` 
      });
    }

    request.status = status;
    await request.save();

    return res.status(200).json({ 
      success: true, 
      message: `Request ${status.toLowerCase()} successfully`,
      request 
    });
  } catch (err) {
    console.error("Error updating request status:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update request status", 
      error: err.message 
    });
  }
};

module.exports = {
  getInventoryItems,
  createInventoryRequest,
  listInventoryRequests,
  updateRequestStatus,
};

