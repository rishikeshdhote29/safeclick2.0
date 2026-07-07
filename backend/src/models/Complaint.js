const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      index: true,
      required: true,
    },
    victimName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    fraudType: {
      type: String,
      required: true,
      enum: ['UPI Fraud', 'Phishing', 'Social Media Harassment', 'Loan App Fraud', 'Other'],
    },
    incidentDate: {
      type: String,
      required: true,
    },
    formData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under-review', 'forwarded', 'accepted', 'rejected', 'pending-clarification', 'package-ready'],
      default: 'submitted',
    },
    handoff: {
      forwardedAt: {
        type: Date,
        default: null,
      },
      forwardedByRole: {
        type: String,
        default: '',
      },
      recipientUnit: {
        type: String,
        default: '',
      },
      officerName: {
        type: String,
        default: '',
      },
      remarks: {
        type: String,
        default: '',
      },
    },
    closure: {
      closedAt: {
        type: Date,
        default: null,
      },
      retentionDeleteAfter: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);
