const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN');
}

function wrapLines(text, font, size, maxWidth) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }

    let currentLine = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const nextLine = `${currentLine} ${words[index]}`;
      if (font.widthOfTextAtSize(nextLine, size) <= maxWidth) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = words[index];
      }
    }
    lines.push(currentLine);
  });

  return lines;
}

function drawWrappedText(page, text, x, y, options) {
  const { font, size, maxWidth, color = rgb(0.13, 0.17, 0.24), lineGap = 6 } = options;
  const lines = wrapLines(text, font, size, maxWidth);
  const lineHeight = size + lineGap;

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
      maxWidth,
    });
  });

  return y - lines.length * lineHeight;
}

function createTableRow(page, cells, config) {
  const { x, y, colWidths, font, fontSize, rowHeight, header = false } = config;
  let cursorX = x;

  cells.forEach((cell, index) => {
    const width = colWidths[index];
    page.drawRectangle({
      x: cursorX,
      y: y - rowHeight,
      width,
      height: rowHeight,
      borderWidth: 1,
      borderColor: rgb(0.8, 0.84, 0.88),
      color: header ? rgb(0.93, 0.96, 0.99) : rgb(1, 1, 1),
    });
    drawWrappedText(page, cell, cursorX + 6, y - 14, {
      font,
      size: fontSize,
      maxWidth: width - 12,
      color: rgb(0.12, 0.12, 0.12),
      lineGap: 2,
    });
    cursorX += width;
  });
}

async function generateComplaintPackagePdf({ complaint, evidences }) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([595.28, 841.89]);
  const margin = 40;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const ensureSpace = (requiredSpace = 80) => {
    if (y < margin + requiredSpace) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  };

  page.drawText('SuRakshaFile - Cyber Complaint Support Packet', {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.25, 0.45),
  });
  y -= 30;

  y = drawWrappedText(page, `Complaint ID: ${complaint._id}`, margin, y, {
    font: regularFont,
    size: 11,
    maxWidth: width,
  }) - 10;

  page.drawText('Complaint Summary', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  const summaryFields = [
    ['Victim name', complaint.victimName],
    ['Phone', complaint.phone],
    ['Email', complaint.email],
    ['City', complaint.city],
    ['State', complaint.state],
    ['Fraud type', complaint.fraudType],
    ['Incident date', complaint.incidentDate],
    ['Status', complaint.status],
    ['Handoff unit', complaint.handoff?.recipientUnit || '-'],
    ['Assigned officer', complaint.handoff?.officerName || '-'],
    ['Forwarded at', formatDate(complaint.handoff?.forwardedAt)],
  ];

  summaryFields.forEach(([label, value]) => {
    ensureSpace(24);
    y = drawWrappedText(page, `${label}: ${value || '-'}`, margin, y, {
      font: regularFont,
      size: 11,
      maxWidth: width,
    }) - 4;
  });

  ensureSpace(150);
  page.drawText('Structured Complaint Details', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  const formData = complaint.formData || {};
  Object.entries(formData).forEach(([key, value]) => {
    ensureSpace(24);
    y = drawWrappedText(page, `${key}: ${Array.isArray(value) ? value.join(', ') : String(value ?? '-')}`, margin, y, {
      font: regularFont,
      size: 11,
      maxWidth: width,
    }) - 3;
  });

  ensureSpace(180);
  page.drawText('Evidence Vault', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 20;

  evidences.forEach((evidence, index) => {
    ensureSpace(170);
    page.drawText(`${index + 1}. ${evidence.originalFilename}`, {
      x: margin,
      y,
      size: 11,
      font: boldFont,
    });
    y -= 14;
    y = drawWrappedText(page, `SHA-256: ${evidence.sha256Hash}`, margin + 12, y, {
      font: regularFont,
      size: 10,
      maxWidth: width - 12,
    }) - 2;
    y = drawWrappedText(page, `Uploaded at: ${formatDate(evidence.uploadedAt)}`, margin + 12, y, {
      font: regularFont,
      size: 10,
      maxWidth: width - 12,
    }) - 2;
    const metadata = evidence.metadata || {};
    y = drawWrappedText(
      page,
      `Metadata: fileType=${metadata.fileType || '-'}, source=${metadata.source || '-'}, device=${metadata.sourceDevice || '-'}, collectedAt=${metadata.collectedAt || '-'}`,
      margin + 12,
      y,
      {
        font: regularFont,
        size: 10,
        maxWidth: width - 12,
      }
    ) - 2;
    y = drawWrappedText(
      page,
      `Transaction ID=${metadata.transactionId || '-'}, platform=${metadata.platformName || '-'}, category=${metadata.complaintCategory || '-'}`,
      margin + 12,
      y,
      {
        font: regularFont,
        size: 10,
        maxWidth: width - 12,
      }
    ) - 2;
    y = drawWrappedText(
      page,
      `Capture method=${metadata.captureMethod || '-'}; limitation=${metadata.captureLimitations || 'Original state before upload cannot be proven by platform hash alone.'}`,
      margin + 12,
      y,
      {
        font: regularFont,
        size: 10,
        maxWidth: width - 12,
      }
    ) - 4;
  });

  ensureSpace(160);
  page.drawText('Section 65B Attestation Workflow (Not Auto-complete)', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  const certificateText = [
    'This packet includes a draft declaration format only.',
    'Final Section 65B attestation must be signed by the lawful certifying person and reviewed by investigating authority.',
    'Platform-generated draft text does not by itself satisfy legal attestation requirements.',
    `Packet generated on: ${new Date().toLocaleDateString('en-IN')}`,
    'Declarant name/signature/date and police verification are mandatory before court filing.',
  ];

  certificateText.forEach((line) => {
    ensureSpace(30);
    y = drawWrappedText(page, line, margin, y, {
      font: regularFont,
      size: 11,
      maxWidth: width,
    }) - 4;
  });

  ensureSpace(180);
  page.drawText('Chain of Custody', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  const tableWidth = width;
  const colWidths = [120, 170, 70, 80, 110];
  const headers = ['File Name', 'Hash', 'Action', 'Actor Role', 'Timestamp'];
  const tableStartY = y;
  createTableRow(page, headers, {
    x: margin,
    y: tableStartY,
    colWidths,
    font: boldFont,
    fontSize: 9,
    rowHeight: 24,
    header: true,
  });
  y -= 24;

  const allRows = [];
  evidences.forEach((evidence) => {
    const logs = evidence.custodyLog?.length ? evidence.custodyLog : [];
    logs.forEach((log) => {
      allRows.push([
        evidence.originalFilename,
        evidence.sha256Hash.slice(0, 24) + (evidence.sha256Hash.length > 24 ? '...' : ''),
        log.action,
        log.actorRole || '-',
        formatDate(log.timestamp),
      ]);
    });
  });

  if (!allRows.length) {
    allRows.push(['No custody records yet', '-', '-', '-', '-']);
  }

  allRows.forEach((row) => {
    ensureSpace(40);
    createTableRow(page, row, {
      x: margin,
      y,
      colWidths,
      font: regularFont,
      fontSize: 9,
      rowHeight: 24,
    });
    y -= 24;
  });

  ensureSpace(220);
  page.drawText('Operational Boundaries and Police Acceptance Notes', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  const boundaryNotes = [
    '1) This tool improves complaint quality and evidence readiness; it does not ensure FIR registration or conviction.',
    '2) Police acceptance depends on jurisdiction process, officer review, and completeness of submitted materials.',
    '3) Uploaded hashes prove integrity after upload; they do not prove pre-upload originality.',
    '4) Escalation path: cyber helpline 1930, local cyber cell, and national cyber portal workflow.',
  ];

  boundaryNotes.forEach((line) => {
    ensureSpace(30);
    y = drawWrappedText(page, line, margin, y, {
      font: regularFont,
      size: 10,
      maxWidth: width,
    }) - 4;
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

module.exports = generateComplaintPackagePdf;
