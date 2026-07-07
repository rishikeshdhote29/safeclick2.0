const fs = require('fs');
const path = require('path');

const Complaint = require('../models/Complaint');
const Evidence = require('../models/Evidence');
const { uploadsRoot } = require('../config/paths');

async function purgeExpiredCases() {
  const now = new Date();
  const expiredComplaints = await Complaint.find({
    'closure.retentionDeleteAfter': { $ne: null, $lte: now },
  });

  if (!expiredComplaints.length) {
    return { deletedComplaints: 0, deletedEvidence: 0 };
  }

  let deletedEvidence = 0;

  for (const complaint of expiredComplaints) {
    const evidences = await Evidence.find({ complaintId: complaint._id });
    for (const evidence of evidences) {
      if (evidence.storagePath && fs.existsSync(evidence.storagePath)) {
        fs.unlinkSync(evidence.storagePath);
      }
      deletedEvidence += 1;
    }

    await Evidence.deleteMany({ complaintId: complaint._id });

    const complaintFolder = path.join(uploadsRoot(), String(complaint._id));
    if (fs.existsSync(complaintFolder)) {
      fs.rmSync(complaintFolder, { recursive: true, force: true });
    }

    await complaint.deleteOne();
  }

  return { deletedComplaints: expiredComplaints.length, deletedEvidence };
}

function startRetentionJob(intervalMs = 60 * 60 * 1000) {
  const run = async () => {
    try {
      const result = await purgeExpiredCases();
      if (result.deletedComplaints > 0) {
        console.log(
          `Retention purge: removed ${result.deletedComplaints} complaint(s) and ${result.deletedEvidence} evidence file(s)`
        );
      }
    } catch (error) {
      console.error('Retention purge failed:', error);
    }
  };

  run();
  return setInterval(run, intervalMs);
}

module.exports = {
  purgeExpiredCases,
  startRetentionJob,
};
