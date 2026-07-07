const express = require('express');
const fs = require('fs');
const path = require('path');

const Complaint = require('../models/Complaint');
const Evidence = require('../models/Evidence');
const hashFile = require('../utils/hashFile');
const { uploadsRoot } = require('../config/paths');
const { ROLES, isComplaintOwner, requireRole } = require('../middleware/access');
const { requireAuth } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/audit');

const router = express.Router();

const UPLOAD_ROOT = uploadsRoot();

function getRequesterClientId(req) {
  return `user-${req.user.id}`;
}

function cleanupUploadedFiles(files) {
  (files || []).forEach((file) => {
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
}

function parseEvidenceMetadata(input = {}) {
  const fallback = {
    fileType: '',
    source: '',
    sourceDevice: '',
    collectedAt: '',
    transactionId: '',
    platformName: '',
    complaintCategory: '',
    captureMethod: '',
    captureLimitations: '',
  };

  if (!input || typeof input !== 'object') {
    return fallback;
  }

  return {
    fileType: String(input.fileType || '').trim(),
    source: String(input.source || '').trim(),
    sourceDevice: String(input.sourceDevice || '').trim(),
    collectedAt: String(input.collectedAt || '').trim(),
    transactionId: String(input.transactionId || '').trim(),
    platformName: String(input.platformName || '').trim(),
    complaintCategory: String(input.complaintCategory || '').trim(),
    captureMethod: String(input.captureMethod || '').trim(),
    captureLimitations: String(input.captureLimitations || '').trim(),
  };
}

function validateMetadata(metadata) {
  const required = ['fileType', 'source', 'sourceDevice', 'collectedAt', 'complaintCategory'];
  const missing = required.filter((field) => !String(metadata[field] || '').trim());
  if (missing.length) {
    return `Missing evidence metadata fields: ${missing.join(', ')}`;
  }
  return null;
}

async function authorizeComplaintAccess(req, complaintId) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    return null;
  }

  if (req.user.role === ROLES.VICTIM) {
    const isOwner = isComplaintOwner(complaint, getRequesterClientId(req));
    if (!isOwner) {
      return null;
    }
  }

  return complaint;
}

function createStorage() {
  const multer = require('multer');

  return multer.diskStorage({
    destination(req, file, cb) {
      const complaintFolder = path.join(UPLOAD_ROOT, String(req.params.complaintId));
      fs.mkdirSync(complaintFolder, { recursive: true });
      cb(null, complaintFolder);
    },
    filename(req, file, cb) {
      const safeName = file.originalname.replace(/[^\w.\-()+\s]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  });
}

const multer = require('multer');
const upload = multer({
  storage: createStorage(),
  limits: { files: 10, fileSize: 20 * 1024 * 1024 },
});

router.use(requireAuth());
router.use(requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.POLICE, ROLES.ADMIN]));

router.post('/:complaintId/upload', requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.ADMIN]), upload.array('files', 10), async (req, res, next) => {
  try {
    const complaint = await authorizeComplaintAccess(req, req.params.complaintId);
    if (!complaint) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    let metadata = {};
    if (req.body.metadataJson) {
      try {
        metadata = JSON.parse(req.body.metadataJson);
      } catch (error) {
        cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: 'metadataJson must be valid JSON' });
      }
    } else {
      metadata = req.body.metadata || req.body;
    }
    const parsedMetadata = parseEvidenceMetadata(metadata);
    const metadataError = validateMetadata(parsedMetadata);
    if (metadataError) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ message: metadataError });
    }

    const createdEvidence = await Promise.all(
      req.files.map(async (file) => {
        const sha256Hash = hashFile(file.path);
        const evidence = await Evidence.create({
          complaintId: complaint._id,
          originalFilename: file.originalname,
          storagePath: file.path,
          sha256Hash,
          fileSize: file.size,
          mimeType: file.mimetype,
          metadata: {
            ...parsedMetadata,
            fileType: parsedMetadata.fileType || file.mimetype || 'unknown',
            complaintCategory: parsedMetadata.complaintCategory || complaint.fraudType,
          },
          uploadedAt: new Date(),
          custodyLog: [
            {
              action: 'uploaded',
              timestamp: new Date(),
              actor: req.user.displayName,
              actorRole: req.user.role,
              note: 'Uploaded and hashed by platform',
            },
          ],
        });

        return {
          _id: evidence._id,
          originalFilename: evidence.originalFilename,
          sha256Hash: evidence.sha256Hash,
          fileSize: evidence.fileSize,
          uploadedAt: evidence.uploadedAt,
          metadata: evidence.metadata,
          custodyLog: evidence.custodyLog,
        };
      })
    );

    await writeAuditLog({
      req,
      action: 'evidence.upload',
      statusCode: 201,
      metadata: { complaintId: String(complaint._id), fileCount: createdEvidence.length },
    });

    return res.status(201).json({
      message: 'Evidence uploaded, hashed, and logged successfully',
      hashGenerated: true,
      evidences: createdEvidence,
      provenanceNotice:
        'Hashing confirms integrity after capture/upload. It cannot prove evidence was unaltered before upload; capture source and method are documented for review.',
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:evidenceId/metadata', requireRole([ROLES.SUPPORT, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const evidence = await Evidence.findById(req.params.evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    const complaint = await authorizeComplaintAccess(req, evidence.complaintId);
    if (!complaint) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    const metadata = parseEvidenceMetadata(req.body.metadata || req.body);
    const metadataError = validateMetadata(metadata);
    if (metadataError) {
      return res.status(400).json({ message: metadataError });
    }

    evidence.metadata = metadata;
    evidence.custodyLog.push({
      action: 'edited',
      timestamp: new Date(),
      actor: req.user.displayName,
      actorRole: req.user.role,
      note: 'Evidence metadata updated',
    });
    await evidence.save();

    await writeAuditLog({
      req,
      action: 'evidence.metadata_update',
      statusCode: 200,
      metadata: { evidenceId: String(evidence._id) },
    });

    return res.json({
      message: 'Evidence metadata updated',
      evidence,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:evidenceId/download', requireRole([ROLES.VICTIM, ROLES.SUPPORT, ROLES.POLICE, ROLES.ADMIN]), async (req, res, next) => {
  try {
    const evidence = await Evidence.findById(req.params.evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    const complaint = await authorizeComplaintAccess(req, evidence.complaintId);
    if (!complaint) {
      return res.status(404).json({ message: 'Evidence not found' });
    }

    evidence.custodyLog.push({
      action: 'exported',
      timestamp: new Date(),
      actor: req.user.displayName,
      actorRole: req.user.role,
      note: 'Evidence downloaded',
    });
    await evidence.save();

    await writeAuditLog({
      req,
      action: 'evidence.download',
      statusCode: 200,
      metadata: { evidenceId: String(evidence._id), complaintId: String(complaint._id) },
    });

    if (!fs.existsSync(evidence.storagePath)) {
      return res.status(404).json({ message: 'Evidence file missing from storage' });
    }

    return res.download(evidence.storagePath, evidence.originalFilename);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
