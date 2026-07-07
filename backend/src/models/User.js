const mongoose = require('mongoose');

const USER_ROLES = ['victim', 'support', 'police', 'admin'];

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, identifier: 1 }, { unique: true });

module.exports = {
  User: mongoose.model('User', userSchema),
  USER_ROLES,
};
