const mongoose = require('mongoose');

const custodyLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    actor: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
      index: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    metadata: {
      fileType: {
        type: String,
        default: '',
      },
      source: {
        type: String,
        default: '',
      },
      sourceDevice: {
        type: String,
        default: '',
      },
      collectedAt: {
        type: String,
        default: '',
      },
      transactionId: {
        type: String,
        default: '',
      },
      platformName: {
        type: String,
        default: '',
      },
      complaintCategory: {
        type: String,
        default: '',
      },
      captureMethod: {
        type: String,
        default: '',
      },
      captureLimitations: {
        type: String,
        default: '',
      },
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    custodyLog: {
      type: [custodyLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Evidence', evidenceSchema);
