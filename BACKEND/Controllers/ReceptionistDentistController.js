// Controllers/ReceptionistDentistController.js (READ-ONLY)
const mongooseX = require('mongoose');
const DentistX = require('../Model/DentistModel');

async function listDentistsPublic(req, res) {
  try {
    const { q, specialization, page = 1, limit = 20 } = req.query;

    // base filter
    const filter = {};
    if (specialization) filter.specialization = specialization;

    // text filter (code / specialization)
    const textFilter = q
      ? {
          $or: [
            { specialization: new RegExp(q, 'i') },
            { dentistCode: new RegExp(q, 'i') },
          ],
        }
      : {};

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const findQuery = DentistX.find({ ...filter, ...textFilter })
      // select only needed dentist fields (includes avatarUrl for photo)
      .select('dentistCode specialization availability_schedule avatarUrl userId')
      .populate({ path: 'userId', select: 'name contact_no role isActive' })
      .lean();

    const [items, total] = await Promise.all([
      // Sorting by populated fields at Mongo level is unreliable; sort by code for stability
      findQuery.sort({ dentistCode: 1 }).skip(skip).limit(limitNum),
      DentistX.countDocuments({ ...filter, ...textFilter }),
    ]);

    return res.status(200).json({
      items: items.map((d) => ({
        _id: d._id,
        dentistCode: d.dentistCode,
        specialization: d.specialization,
        availability_schedule: d.availability_schedule,
        avatarUrl: d.avatarUrl, // <-- added for photo
        name: d.userId?.name,
        contact_no: d.userId?.contact_no,
        isActive: d.userId?.isActive,
      })),
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: 'Failed to list dentists', error: err.message });
  }
}

async function getDentistPublic(req, res) {
  try {
    const { idOrCode } = req.params;
    const byId = mongooseX.isValidObjectId(idOrCode);
    const where = byId ? { _id: idOrCode } : { dentistCode: idOrCode };

    const d = await DentistX.findOne(where)
      .select('dentistCode specialization availability_schedule avatarUrl userId')
      .populate({ path: 'userId', select: 'name contact_no role isActive' })
      .lean();

    if (!d) return res.status(404).json({ message: 'Dentist not found' });

    return res.status(200).json({
      dentist: {
        _id: d._id,
        dentistCode: d.dentistCode,
        specialization: d.specialization,
        availability_schedule: d.availability_schedule,
        avatarUrl: d.avatarUrl, // <-- added for photo
        name: d.userId?.name,
        contact_no: d.userId?.contact_no,
        isActive: d.userId?.isActive,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: 'Failed to fetch dentist', error: err.message });
  }
}

/**
 * NEW: list distinct specializations for dropdown
 * GET /receptionist/dentists/specializations
 */
async function listDentistSpecializationsPublic(req, res) {
  try {
    const specs = await DentistX.distinct('specialization', {
      specialization: { $exists: true, $ne: null, $ne: '' },
    });
    specs.sort((a, b) => String(a).localeCompare(String(b)));
    return res.status(200).json({ specializations: specs });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: 'Failed to list specializations', error: err.message });
  }
}

module.exports = { 
  listDentistsPublic, 
  getDentistPublic,
  listDentistSpecializationsPublic // <-- export the new endpoint
};
