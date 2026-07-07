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

/**
 * Draws one table row whose height adapts to its tallest (possibly wrapped)
 * cell, vertically centers each cell's text block, and returns the y
 * coordinate for the *next* row so callers never have to hardcode a
 * row-advance amount that can drift out of sync with the drawn height.
 */
function createTableRow(page, cells, config) {
  const {
    x,
    y,
    colWidths,
    font,
    fontSize,
    minRowHeight = 24,
    cellPaddingX = 6,
    cellPaddingY = 6,
    lineGap = 2,
    header = false,
  } = config;

  const lineHeight = fontSize + lineGap;

  // 1) Pre-wrap every cell so we know how tall this row actually needs to be.
  const cellLines = cells.map((cell, index) => {
    const maxWidth = colWidths[index] - cellPaddingX * 2;
    return wrapLines(String(cell ?? '-'), font, fontSize, maxWidth);
  });

  const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
  const contentHeight = maxLines * lineHeight;
  const rowHeight = Math.max(minRowHeight, contentHeight + cellPaddingY * 2);

  // 2) Draw cell backgrounds/borders using the computed row height.
  let cursorX = x;
  colWidths.forEach((width) => {
    page.drawRectangle({
      x: cursorX,
      y: y - rowHeight,
      width,
      height: rowHeight,
      borderWidth: 1,
      borderColor: rgb(0.8, 0.84, 0.88),
      color: header ? rgb(0.93, 0.96, 0.99) : rgb(1, 1, 1),
    });
    cursorX += width;
  });

  // 3) Draw text, vertically centered within the row.
  cursorX = x;
  cellLines.forEach((lines, index) => {
    const width = colWidths[index];
    const blockHeight = lines.length * lineHeight;
    // Top of the text block, centered in the row, then nudged down to the
    // first line's baseline (approximated as ~0.8 * fontSize below the cap).
    const blockTopY = y - (rowHeight - blockHeight) / 2 - fontSize * 0.8;

    lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: cursorX + cellPaddingX,
        y: blockTopY - lineIndex * lineHeight,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
        maxWidth: width - cellPaddingX * 2,
      });
    });

    cursorX += width;
  });

  return y - rowHeight;
}

function centerText(page, text, centerX, y, { font, size, color = rgb(0.1, 0.1, 0.1) }) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: centerX - textWidth / 2,
    y,
    size,
    font,
    color,
  });
}

/**
 * Draws the Section 65B attestation as a single, self-contained certificate
 * page: bordered like a formal certificate, with a declaration paragraph
 * that has blanks for name/designation, and a signature block at the
 * bottom. Nothing else is placed on this page, and nothing on this page
 * flows past its own fixed layout, so it will always occupy exactly one
 * fresh page.
 */
function drawSection65BCertificatePage(page, { margin, width, boldFont, regularFont, complaintId }) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const navy = rgb(0.1, 0.25, 0.45);
  const ink = rgb(0.15, 0.15, 0.15);
  const centerX = pageWidth / 2;

  // Outer + inner decorative border, certificate-style.
  const borderInset = margin - 14;
  page.drawRectangle({
    x: borderInset,
    y: borderInset,
    width: pageWidth - borderInset * 2,
    height: pageHeight - borderInset * 2,
    borderWidth: 1.5,
    borderColor: navy,
  });
  page.drawRectangle({
    x: borderInset + 6,
    y: borderInset + 6,
    width: pageWidth - (borderInset + 6) * 2,
    height: pageHeight - (borderInset + 6) * 2,
    borderWidth: 0.5,
    borderColor: navy,
  });

  let y = pageHeight - margin - 20;

  centerText(page, 'CERTIFICATE UNDER SECTION 65B', centerX, y, { font: boldFont, size: 16, color: navy });
  y -= 20;
  centerText(page, 'OF THE INDIAN EVIDENCE ACT, 1872', centerX, y, { font: boldFont, size: 16, color: navy });
  y -= 22;
  centerText(page, '(Draft Template — Requires Review and Attestation by Lawful Certifying Authority)', centerX, y, {
    font: regularFont,
    size: 9.5,
    color: ink,
  });
  y -= 10;

  // Divider rule under the title block.
  page.drawLine({
    start: { x: margin + 30, y },
    end: { x: pageWidth - margin - 30, y },
    thickness: 1,
    color: navy,
  });
  y -= 30;

  const paragraphMaxWidth = width - 20;
  const paragraphX = margin + 10;

  const declaration = `I, ______________________________________________, holding the position/rank of ______________________________________________, do hereby certify, pursuant to Section 65B of the Indian Evidence Act, 1872, that the electronic records annexed to Complaint ID: ${complaintId} were produced from a device or computer system under my lawful control and management, and that, to the best of my knowledge and belief, the said records have not been altered, tampered with, or manipulated during the course of their collection, storage, or transfer.`;

  y = drawWrappedText(page, declaration, paragraphX, y, {
    font: regularFont,
    size: 11,
    maxWidth: paragraphMaxWidth,
    color: ink,
    lineGap: 7,
  }) - 16;

  const notes = [
    'This certificate is a draft format only and is not, by itself, a completed legal attestation.',
    'Final execution requires the signature of the lawful certifying person named above, followed by review by the investigating authority prior to court filing.',
  ];
  notes.forEach((note) => {
    y = drawWrappedText(page, note, paragraphX, y, {
      font: regularFont,
      size: 9.5,
      maxWidth: paragraphMaxWidth,
      color: rgb(0.35, 0.35, 0.35),
      lineGap: 5,
    }) - 6;
  });

  // Signature block, anchored near the bottom of the page.
  const blockY = margin + 130;
  const lineLength = (width - 40) / 2 - 10;
  const leftX = margin + 10;
  const rightX = margin + 10 + (width - 40) / 2 + 10;

  const signatureRow = (label, x, rowY) => {
    page.drawLine({
      start: { x, y: rowY },
      end: { x: x + lineLength, y: rowY },
      thickness: 1,
      color: ink,
    });
    page.drawText(label, {
      x,
      y: rowY - 14,
      size: 9,
      font: regularFont,
      color: rgb(0.35, 0.35, 0.35),
    });
  };

  signatureRow('Name of Declarant', leftX, blockY);
  signatureRow('Designation / Rank', rightX, blockY);
  signatureRow('Signature', leftX, blockY - 55);
  signatureRow('Date', rightX, blockY - 55);
  signatureRow('Place', leftX, blockY - 110);
  signatureRow('Police Verification / Reviewing Officer', rightX, blockY - 110);

  centerText(
    page,
    `Packet generated on: ${new Date().toLocaleDateString('en-IN')}`,
    centerX,
    margin + 20,
    { font: regularFont, size: 8.5, color: rgb(0.5, 0.5, 0.5) }
  );
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

  // Section 65B attestation gets its own dedicated, fresh page laid out as
  // a formal certificate rather than another paragraph in the running text.
  page = pdfDoc.addPage([595.28, 841.89]);
  drawSection65BCertificatePage(page, {
    margin,
    width,
    boldFont,
    regularFont,
    complaintId: complaint._id,
  });

  // Whatever follows (Chain of Custody, etc.) starts on its own fresh page
  // too, so the certificate page is never shared with other content.
  page = pdfDoc.addPage([595.28, 841.89]);
  y = page.getHeight() - margin;

  ensureSpace(180);
  page.drawText('Chain of Custody', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
  });
  y -= 18;

  // Column widths as proportions of the available content width so the
  // table can never overflow the right margin, regardless of page size.
  const colFractions = [0.24, 0.32, 0.14, 0.15, 0.15];
  const colWidths = colFractions.map((fraction) => fraction * width);

  const headers = ['File Name', 'Hash', 'Action', 'Actor Role', 'Timestamp'];

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

  // Redraw the header on every page the table spans, so a page break never
  // leaves body rows without their column labels.
  const drawTableHeader = () => {
    y = createTableRow(page, headers, {
      x: margin,
      y,
      colWidths,
      font: boldFont,
      fontSize: 9,
      minRowHeight: 24,
      header: true,
    });
  };

  drawTableHeader();

  allRows.forEach((row) => {
    if (y < margin + 60) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
      drawTableHeader();
    }
    y = createTableRow(page, row, {
      x: margin,
      y,
      colWidths,
      font: regularFont,
      fontSize: 9,
      minRowHeight: 24,
    });
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