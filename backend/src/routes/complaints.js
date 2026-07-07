const express = require('express');

const Complaint = require('../models/Complaint');
const Evidence = require('../models/Evidence');
const generateComplaintPackagePdf = require('../utils/pdf');
const { ROLES, isComplaintOwner, requireRole } = require('../middleware/access');
const { requireAuth } = require('../middleware/auth');
const { encryptText, decryptText } = require('../utils/security');
const { writeAuditLog } = require('../utils/audit');

const router = express.Router();
const FRAUD_TYPES = ['UPI Fraud', 'Phishing', 'Social Media Harassment', 'Loan App Fraud', 'Other'];
const TRACKED_STATUSES = ['submitted', 'under-review', 'forwarded', 'accepted', 'rejected', 'pending-clarification', 'package-ready'];

function getRequesterClientId(req) {
  return `user-${req.user.id}`;
}

function decryptComplaintFields(complaintLike) {
  const complaint = complaintLike.toObject ? complaintLike.toObject() : { ...complaintLike };
  return {
    ...complaint,
    phone: decryptText(complaint.phone),
    email: decryptText(complaint.email),
  };
}

function validateComplaintPayload(payload) {
  const required = ['victimName', 'phone', 'email', 'city', 'state', 'fraudType', 'incidentDate'];
  const missing = required.filter((field) => !String(payload[field] || '').trim());

  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  if (!FRAUD_TYPES.includes(payload.fraudType)) {
    return 'Invalid fraud type';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(payload.email).trim())) {
    return 'Invalid email address';
  }

  const phoneRegex = /^[0-9+()\-\s]{7,18}$/;
  if (!phoneRegex.test(String(payload.phone).trim())) {
    return 'Invalid phone number';
  }

  const formData = payload.formData || {};
  const fraudSpecificChecks = {
    'UPI Fraud': ['transactionId', 'recipientUpiId', 'amount', 'bankName', 'dateTime'],
    Phishing: ['suspiciousContent', 'senderId', 'platform'],
    'Social Media Harassment': ['platformName', 'profileLink', 'natureOfHarassment'],
    'Loan App Fraud': ['appName', 'amount', 'threateningNumber'],
  };

  const requiredExtras = fraudSpecificChecks[payload.fraudType] || [];
  const missingExtra = requiredExtras.filter((field) => !String(formData[field] || '').trim());
  if (missingExtra.length) {
    return `Missing fraud-specific fields: ${missingExtra.join(', ')}`;
  }

  return null;
}

function buildComplaintResponse(complaint, evidenceCount) {
  return {
    complaint: decryptComplaintFields(complaint),
    evidenceCount,
  };
}

async function loadAccessibleComplaint(req, res, id) {
  const complaint = await Complaint.findById(id);
  if (!complaint) {
    res.status(404).json({ message: 'Complaint not found' });
    return null;
  }

  if (req.user.role === ROLES.VICTIM) {
    if (!isComplaintOwner(complaint, getRequesterClientId(req))) {
      res.status(404).json({ message: 'Complaint not found' });
      return null;
    }
  }

  return complaint;
}

router.use(requireAuth());
router.use(requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.POLICE, ROLES.ADMIN]));

router.post('/', requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const validationError = validateComplaintPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const ownerClientId =
      req.user.role === ROLES.VICTIM
        ? getRequesterClientId(req)
        : String(req.body.victimClientId || '').trim();

    if (!ownerClientId) {
      return res.status(400).json({ message: 'victimClientId is required for support/admin complaint creation' });
    }

    const complaint = await Complaint.create({
      clientId: ownerClientId,
      victimName: req.body.victimName,
      phone: encryptText(req.body.phone),
      email: encryptText(req.body.email),
      city: req.body.city,
      state: req.body.state,
      fraudType: req.body.fraudType,
      incidentDate: req.body.incidentDate,
      formData: req.body.formData || {},
      status: 'submitted',
    });

    await writeAuditLog({
      req,
      action: 'complaint.create',
      statusCode: 201,
      metadata: { complaintId: String(complaint._id), ownerClientId },
    });

    return res.status(201).json(buildComplaintResponse(complaint, 0));
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = req.user.role === ROLES.VICTIM ? { clientId: getRequesterClientId(req) } : {};
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean();
    const counts = await Evidence.aggregate([
      {
        $match: {
          complaintId: { $in: complaints.map((complaint) => complaint._id) },
        },
      },
      {
        $group: {
          _id: '$complaintId',
          count: { $sum: 1 },
        },
      },
    ]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

    const response = complaints.map((complaint) => ({
      ...decryptComplaintFields(complaint),
      evidenceCount: countMap.get(String(complaint._id)) || 0,
    }));

    await writeAuditLog({
      req,
      action: 'complaint.list',
      statusCode: 200,
      metadata: { count: response.length, role: req.user.role },
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const complaint = await loadAccessibleComplaint(req, res, req.params.id);
    if (!complaint) {
      return null;
    }

    const evidences = await Evidence.find({ complaintId: complaint._id }).sort({ uploadedAt: -1 }).lean();

    await writeAuditLog({
      req,
      action: 'complaint.view',
      statusCode: 200,
      metadata: { complaintId: String(complaint._id), evidenceCount: evidences.length },
    });

    return res.json({
      complaint: decryptComplaintFields(complaint),
      evidences,
      evidenceCount: evidences.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const complaint = await loadAccessibleComplaint(req, res, req.params.id);
    if (!complaint) {
      return null;
    }

    const validationError = validateComplaintPayload(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    complaint.victimName = req.body.victimName;
    complaint.phone = encryptText(req.body.phone);
    complaint.email = encryptText(req.body.email);
    complaint.city = req.body.city;
    complaint.state = req.body.state;
    complaint.fraudType = req.body.fraudType;
    complaint.incidentDate = req.body.incidentDate;
    complaint.formData = req.body.formData || {};
    if (complaint.status === 'package-ready') {
      complaint.status = 'submitted';
    }

    await complaint.save();

    await writeAuditLog({
      req,
      action: 'complaint.update',
      statusCode: 200,
      metadata: { complaintId: String(complaint._id) },
    });

    const evidenceCount = await Evidence.countDocuments({ complaintId: complaint._id });
    return res.json(buildComplaintResponse(complaint, evidenceCount));
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/status', requireRole([ROLES.SUPPORT, ROLES.POLICE, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    const status = String(req.body.status || '').trim();
    if (!TRACKED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition target' });
    }

    complaint.status = status;
    if (status === 'forwarded') {
      complaint.handoff.forwardedAt = new Date();
      complaint.handoff.forwardedByRole = req.user.role;
      complaint.handoff.recipientUnit = String(req.body.recipientUnit || '').trim();
      complaint.handoff.officerName = String(req.body.officerName || '').trim();
      complaint.handoff.remarks = String(req.body.remarks || '').trim();
    }

    if (status === 'accepted' || status === 'rejected') {
      const retentionDays = Number(process.env.CASE_RETENTION_DAYS || 90);
      const now = new Date();
      complaint.closure.closedAt = now;
      complaint.closure.retentionDeleteAfter = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
    } else {
      complaint.closure.closedAt = null;
      complaint.closure.retentionDeleteAfter = null;
    }

    await complaint.save();

    await writeAuditLog({
      req,
      action: 'complaint.status_update',
      statusCode: 200,
      metadata: { complaintId: String(complaint._id), status: complaint.status },
    });

    return res.json({
      message: 'Status updated',
      complaint: decryptComplaintFields(complaint),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/package', async (req, res, next) => {
  try {
    const complaint = await loadAccessibleComplaint(req, res, req.params.id);
    if (!complaint) {
      return null;
    }

    const evidences = await Evidence.find({ complaintId: complaint._id }).sort({ uploadedAt: 1 }).lean();
    if (evidences.length) {
      await Evidence.updateMany(
        { complaintId: complaint._id },
        {
          $push: {
            custodyLog: {
              action: 'exported',
              timestamp: new Date(),
              actor: req.user.displayName,
              actorRole: req.user.role,
              note: 'Included in police-ready package export',
            },
          },
        }
      );
    }

    const pdfBuffer = await generateComplaintPackagePdf({ complaint: decryptComplaintFields(complaint), evidences });
    const filename = `SuRakshaFile-Complaint-${String(complaint._id).slice(-6)}.pdf`;

    await writeAuditLog({
      req,
      action: 'complaint.package_export',
      statusCode: 200,
      metadata: { complaintId: String(complaint._id), evidenceCount: evidences.length },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/evidences', async (req, res, next) => {
  try {
    const complaint = await loadAccessibleComplaint(req, res, req.params.id);
    if (!complaint) {
      return null;
    }

    const evidences = await Evidence.find({ complaintId: req.params.id }).sort({ uploadedAt: -1 }).lean();
    return res.json(evidences);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
