import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import type { ReceiptTemplateRecord } from "../receipt-template/receipt-template.model";
import type { PaymentRecord } from "./payments.model";
import type { ReceiptBranding } from "./receipt-branding.repository";

export type ReceiptCopyMode = "STUDENT" | "BOTH";

interface ReceiptSource {
  payment: PaymentRecord;
  template: ReceiptTemplateRecord;
  orders: FeeOrderRecord[];
  branding: ReceiptBranding;
}

const ascii = (value: unknown) =>
  String(value ?? "-").replace(/[^\x20-\x7E]/g, " ");
const fit = (value: unknown, max: number) => {
  const text = ascii(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 3))}...`;
};
const money = (minor: number) =>
  `INR ${(minor / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function fitTextToWidth(value: unknown, font: PDFFont, size: number, maxWidth: number) {
  const text = ascii(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && font.widthOfTextAtSize(`${text.slice(0, end)}...`, size) > maxWidth) end -= 1;
  return `${text.slice(0, end)}...`;
}

function centeredTextX(text: string, font: PDFFont, size: number, x: number, width: number) {
  return x + Math.max(0, (width - font.widthOfTextAtSize(text, size)) / 2);
}

function templateColor(value: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "176b55";
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  );
}

const numberWords = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tensWords = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(value: number): string {
  if (value < 20) return numberWords[value] ?? "";
  if (value < 100) return `${tensWords[Math.floor(value / 10)]} ${numberWords[value % 10]}`.trim();
  return `${numberWords[Math.floor(value / 100)]} Hundred ${belowThousand(value % 100)}`.trim();
}

function amountInWords(minor: number): string {
  let value = Math.floor(Math.abs(minor) / 100);
  if (value === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const groups: Array<[number, string]> = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
  ];
  for (const [unit, label] of groups) {
    if (value >= unit) {
      parts.push(`${belowThousand(Math.floor(value / unit))} ${label}`);
      value %= unit;
    }
  }
  if (value) parts.push(belowThousand(value));
  return `Rupees ${parts.join(" ")} Only`;
}

async function embedLogo(document: PDFDocument, branding: ReceiptBranding) {
  if (!branding.logoBytes) return undefined;
  try {
    return branding.logoContentType?.includes("png")
      ? await document.embedPng(branding.logoBytes)
      : await document.embedJpg(branding.logoBytes);
  } catch {
    return undefined;
  }
}

export async function renderReceiptPdf(input: ReceiptSource & { copyMode?: ReceiptCopyMode }): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const [portraitWidth, portraitHeight] = PageSizes.A4;
  const page = document.addPage([portraitHeight, portraitWidth]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const logo = await embedLogo(document, input.branding);
  const both = input.copyMode === "BOTH";
  const accent = templateColor(input.template.accentColor);
  const margin = 12;
  const gap = 12;
  // A student-only receipt keeps the exact physical dimensions of one copy
  // from the dual layout so printed records remain consistent.
  const copyWidth = (page.getWidth() - margin * 2 - gap) / 2;
  const copyHeight = page.getHeight() - margin * 2;

  drawReceiptCopy(page, input, {
    x: margin,
    y: margin,
    width: copyWidth,
    height: copyHeight,
    label: "STUDENT COPY",
    accent,
    pale: rgb(.94, .97, .96),
    regular,
    bold,
    italic,
    ...(logo ? { logo } : {}),
  });
  if (both) {
    const divider = margin + copyWidth + gap / 2;
    page.drawLine({
      start: { x: divider, y: 8 },
      end: { x: divider, y: page.getHeight() - 8 },
      dashArray: [3, 3],
      color: rgb(.25, .28, .32),
    });
    page.drawText("X", { x: divider - 3, y: page.getHeight() - 12, size: 7, font: bold });
    drawReceiptCopy(page, input, {
      x: margin + copyWidth + gap,
      y: margin,
      width: copyWidth,
      height: copyHeight,
      label: "OFFICE COPY",
      accent,
      pale: rgb(.94, .97, .96),
      regular,
      bold,
      italic,
      ...(logo ? { logo } : {}),
    });
  }

  document.setTitle(input.payment.receiptNumber);
  document.setSubject(`${input.branding.institutionName} fee receipt`);
  return document.save();
}

interface CopyLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  accent: ReturnType<typeof rgb>;
  pale: ReturnType<typeof rgb>;
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  logo?: PDFImage;
}

function drawReceiptCopy(page: PDFPage, source: ReceiptSource, layout: CopyLayout) {
  const { payment, template, orders, branding } = source;
  const { x, y, width, height, accent, pale, regular, bold, italic, logo } = layout;
  const scale = Math.min(1.08, width / 390, height / 535);
  const u = (value: number) => value * scale;
  const pad = u(8);
  const innerX = x + pad;
  const innerWidth = width - pad * 2;

  page.drawRectangle({ x, y, width, height, borderWidth: .75, borderColor: accent });
  page.drawRectangle({
    x: x + width - u(86),
    y: y + height - u(9),
    width: u(72),
    height: u(18),
    color: accent,
  });
  page.drawText(layout.label, {
    x: x + width - u(78),
    y: y + height - u(3),
    size: u(7.5),
    font: bold,
    color: rgb(1, 1, 1),
  });

  if (logo && template.showInstitutionLogo) {
    const headerScale = Math.min(u(56) / logo.width, u(56) / logo.height);
    page.drawImage(logo, {
      x: innerX + u(3),
      y: y + height - u(70),
      width: logo.width * headerScale,
      height: logo.height * headerScale,
    });
    const watermarkScale = Math.min(u(210) / logo.width, u(210) / logo.height);
    page.drawImage(logo, {
      x: x + (width - logo.width * watermarkScale) / 2,
      y: y + (height - logo.height * watermarkScale) / 2,
      width: logo.width * watermarkScale,
      height: logo.height * watermarkScale,
      opacity: .045,
    });
  }

  const logoReservedWidth = logo && template.showInstitutionLogo ? u(61) : 0;
  // Reserve the logo width on both sides. This keeps branding text centered
  // against the receipt border instead of centering it in the space after the logo.
  const headerX = innerX + logoReservedWidth;
  const headerWidth = innerWidth - logoReservedWidth * 2;
  const institutionSize = u(15);
  const institutionName = fitTextToWidth(
    branding.institutionName,
    bold,
    institutionSize,
    headerWidth,
  );
  page.drawText(institutionName, {
    x: centeredTextX(institutionName, bold, institutionSize, headerX, headerWidth),
    y: y + height - u(27),
    size: institutionSize,
    font: bold,
    color: accent,
  });
  const campusSize = u(8.5);
  const campusName = fitTextToWidth(branding.campusName, bold, campusSize, headerWidth);
  page.drawText(campusName, {
    x: centeredTextX(campusName, bold, campusSize, headerX, headerWidth),
    y: y + height - u(44),
    size: campusSize,
    font: bold,
  });
  if (template.showInstitutionAddress) {
    const detailSize = u(6.2);
    const address = fitTextToWidth(branding.address, regular, detailSize, headerWidth);
    page.drawText(address, {
      x: centeredTextX(address, regular, detailSize, headerX, headerWidth),
      y: y + height - u(56),
      size: detailSize,
      font: regular,
    });
    const contact = fitTextToWidth(
      [branding.contactPhone, branding.contactEmail].filter(Boolean).join("  |  "),
      regular,
      detailSize,
      headerWidth,
    );
    page.drawText(contact, {
      x: centeredTextX(contact, regular, detailSize, headerX, headerWidth),
      y: y + height - u(67),
      size: detailSize,
      font: regular,
    });
  }

  let cursor = y + height - u(82);
  page.drawLine({ start: { x: innerX, y: cursor }, end: { x: innerX + innerWidth, y: cursor }, thickness: .8, color: accent });
  const receiptTitle = fit(template.title.toUpperCase(), 28);
  const receiptTitleSize = u(receiptTitle.length > 18 ? 8 : 11);
  const receiptTitleWidth = bold.widthOfTextAtSize(receiptTitle, receiptTitleSize);
  const receiptTitleBoxWidth = Math.min(innerWidth, receiptTitleWidth + u(22));
  page.drawRectangle({
    x: x + (width - receiptTitleBoxWidth) / 2,
    y: cursor - u(11),
    width: receiptTitleBoxWidth,
    height: u(21),
    color: accent,
  });
  page.drawText(receiptTitle, {
    x: x + (width - receiptTitleWidth) / 2,
    y: cursor - u(4),
    size: receiptTitleSize,
    font: bold,
    color: rgb(1, 1, 1),
  });

  cursor -= u(31);
  if (template.headerText) {
    page.drawText(fit(template.headerText, 95), {
      x: innerX,
      y: cursor + u(8),
      size: u(5.6),
      font: italic,
      color: accent,
    });
  }
  const infoWidth = innerWidth * .62;
  const amountBoxX = innerX + infoWidth + u(5);
  const paymentRows = [
    ["Receipt No.", payment.receiptNumber],
    ["Payment Date", payment.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
    ["Payment Mode", template.showPaymentMethod ? payment.method.replaceAll("_", " ") : "-"],
    ["Reference / UTR", template.showPaymentReference ? payment.reference ?? "-" : "-"],
    ["Collected By", branding.collectedByName ?? "Authorized cashier"],
  ];
  paymentRows.forEach(([label, value], index) => {
    const rowY = cursor - u(index * 13);
    page.drawText(label ?? "", { x: innerX + u(2), y: rowY, size: u(6.5), font: bold });
    page.drawText(":", { x: innerX + u(75), y: rowY, size: u(6.5), font: bold });
    page.drawText(fit(value, 32), {
      x: innerX + u(84),
      y: rowY,
      size: u(6.7),
      font: label === "Receipt No." ? bold : regular,
      color: label === "Receipt No." ? rgb(.82, .03, .04) : rgb(.06, .08, .11),
    });
  });
  page.drawRectangle({
    x: amountBoxX,
    y: cursor - u(55),
    width: innerX + innerWidth - amountBoxX,
    height: u(57),
    borderWidth: .55,
    borderColor: accent,
    color: rgb(.99, .99, .99),
  });
  page.drawText("Amount in Words", { x: amountBoxX + u(7), y: cursor - u(10), size: u(6.5), font: bold });
  const words = amountInWords(payment.amountMinor);
  const splitAt = Math.min(words.length, 31);
  page.drawText(fit(words.slice(0, splitAt), 35), { x: amountBoxX + u(7), y: cursor - u(30), size: u(7.2), font: italic, color: accent });
  if (words.length > splitAt) page.drawText(fit(words.slice(splitAt).trim(), 35), { x: amountBoxX + u(7), y: cursor - u(42), size: u(7.2), font: italic, color: accent });

  cursor -= u(76);
  cursor = drawSectionTitle(page, "STUDENT INFORMATION", innerX, cursor, innerWidth, u(15), accent, pale, bold, scale);
  const first = orders[0];
  const studentRows = [
    ["Student Name", payment.studentName, "Class & Section", [branding.className, branding.sectionName].filter(Boolean).join(" - ") || "-"],
    ["Admission No.", branding.admissionNumber ?? "-", "Registration No.", first?.registrationNumber ?? "-"],
    ["Academic Year", branding.academicYearName, "", ""],
  ];
  studentRows.forEach((row, index) => drawFourColumnRow(page, row, innerX, cursor - u(index * 15), innerWidth, regular, bold, scale));
  cursor -= u(48);

  cursor = drawSectionTitle(page, "FEE DETAILS", innerX, cursor, innerWidth, u(15), accent, accent, bold, scale, true);
  const columns = [0, .08, .29, .48, .63, .76, .89, 1].map((ratio) => innerX + innerWidth * ratio);
  const headings = ["Sl.No.", "Fee Head", "Fee Order No.", "Total Amount", "Previous Paid", "Paid Now", "Balance"];
  page.drawRectangle({ x: innerX, y: cursor - u(18), width: innerWidth, height: u(18), borderWidth: .4, borderColor: accent, color: pale });
  headings.forEach((heading, index) => page.drawText(heading, {
    x: (columns[index] ?? innerX) + u(2),
    y: cursor - u(11),
    size: u(5.1),
    font: bold,
  }));
  cursor -= u(18);

  const allocationByOrder = new Map(payment.allocations.map((allocation) => [allocation.feeOrderId, allocation]));
  const rows = orders.flatMap((order) => {
    const allocation = allocationByOrder.get(order.id);
    const currentByCharge = new Map((allocation?.chargeAllocations ?? []).map((charge) => [charge.chargeId, charge.amountMinor]));
    return order.charges
      .filter((charge) => charge.amountMinor > 0)
      .map((charge) => {
        const paidNow = currentByCharge.get(charge.id) ?? 0;
        return {
          label: charge.label,
          orderNumber: order.orderNumber,
          totalMinor: charge.amountMinor,
          previousPaidMinor: Math.max(0, charge.paidMinor - paidNow),
          paidNowMinor: paidNow,
          balanceMinor: charge.balanceMinor,
        };
      });
  }).slice(0, 7);

  rows.forEach((row, rowIndex) => {
    const rowHeight = u(17);
    page.drawRectangle({ x: innerX, y: cursor - rowHeight, width: innerWidth, height: rowHeight, borderWidth: .35, borderColor: rgb(.55, .59, .63) });
    columns.slice(1, -1).forEach((columnX) => page.drawLine({ start: { x: columnX, y: cursor - rowHeight }, end: { x: columnX, y: cursor }, thickness: .3, color: rgb(.55, .59, .63) }));
    const values = [
      String(rowIndex + 1),
      fit(row.label, 23),
      fit(row.orderNumber, 19),
      money(row.totalMinor).replace("INR ", ""),
      money(row.previousPaidMinor).replace("INR ", ""),
      money(row.paidNowMinor).replace("INR ", ""),
      money(row.balanceMinor).replace("INR ", ""),
    ];
    values.forEach((value, index) => page.drawText(value, {
      x: (columns[index] ?? innerX) + u(2),
      y: cursor - u(11),
      size: u(5.4),
      font: index === 1 ? regular : bold,
    }));
    cursor -= rowHeight;
  });

  const totalOrder = orders.reduce((sum, order) => sum + order.totalMinor, 0);
  const totalPaid = orders.reduce((sum, order) => sum + order.paidMinor, 0);
  const totalBalance = orders.reduce((sum, order) => sum + order.balanceMinor, 0);
  const previousPaid = Math.max(0, totalPaid - payment.amountMinor);
  cursor -= u(9);
  const summaryWidth = innerWidth * .58;
  page.drawRectangle({ x: innerX + u(8), y: cursor - u(67), width: summaryWidth - u(12), height: u(67), borderWidth: .55, borderColor: accent });
  page.drawText("Payment Summary", { x: innerX + u(58), y: cursor - u(12), size: u(7), font: bold });
  [
    ["Total Order Amount", totalOrder],
    ["Total Paid (Before)", previousPaid],
    ["Paid Now", payment.amountMinor],
    ["Balance Amount", totalBalance],
  ].forEach(([label, amount], index) => {
    const lineY = cursor - u(27 + index * 12);
    page.drawText(String(label), { x: innerX + u(18), y: lineY, size: u(5.9), font: index === 3 ? bold : regular });
    page.drawText(money(Number(amount)), { x: innerX + summaryWidth - u(74), y: lineY, size: u(6.1), font: bold, color: index === 3 ? rgb(1, 1, 1) : rgb(.05, .07, .1) });
    if (index === 3) page.drawRectangle({ x: innerX + u(10), y: lineY - u(4), width: summaryWidth - u(16), height: u(12), color: accent, opacity: .98 });
    if (index === 3) {
      page.drawText(String(label), { x: innerX + u(18), y: lineY, size: u(5.9), font: bold, color: rgb(1, 1, 1) });
      page.drawText(money(Number(amount)), { x: innerX + summaryWidth - u(74), y: lineY, size: u(6.1), font: bold, color: rgb(1, 1, 1) });
    }
  });
  const totalBoxX = innerX + summaryWidth + u(8);
  page.drawRectangle({ x: totalBoxX, y: cursor - u(55), width: innerX + innerWidth - totalBoxX - u(8), height: u(48), borderWidth: .65, borderColor: accent });
  page.drawText("TOTAL PAID NOW", { x: totalBoxX + u(25), y: cursor - u(23), size: u(7), font: bold, color: accent });
  page.drawText(money(payment.amountMinor), { x: totalBoxX + u(17), y: cursor - u(43), size: u(13), font: bold, color: accent });

  const footerY = y + u(18);
  page.drawText(fit(template.footerText || "This is a computer generated receipt and does not require any signature.", 90), {
    x: innerX,
    y: footerY + u(20),
    size: u(5.8),
    font: regular,
  });
  page.drawLine({ start: { x: innerX, y: footerY + u(10) }, end: { x: innerX + innerWidth, y: footerY + u(10) }, thickness: .5, color: accent });
  page.drawText(ascii(template.signatureLabel || "Authorized Signatory"), {
    x: innerX + innerWidth - u(85),
    y: footerY - u(2),
    size: u(6.5),
    font: bold,
    color: accent,
  });
}

function drawSectionTitle(
  page: PDFPage,
  title: string,
  x: number,
  cursor: number,
  width: number,
  height: number,
  accent: ReturnType<typeof rgb>,
  fill: ReturnType<typeof rgb>,
  bold: PDFFont,
  scale: number,
  inverse = false,
) {
  page.drawRectangle({ x, y: cursor - height, width, height, borderWidth: .45, borderColor: accent, color: fill });
  const titleWidth = title.length * 4.1 * scale;
  page.drawText(title, {
    x: x + (width - titleWidth) / 2,
    y: cursor - height + 4 * scale,
    size: 7 * scale,
    font: bold,
    color: inverse ? rgb(1, 1, 1) : accent,
  });
  return cursor - height;
}

function drawFourColumnRow(
  page: PDFPage,
  values: string[],
  x: number,
  y: number,
  width: number,
  regular: PDFFont,
  bold: PDFFont,
  scale: number,
) {
  const half = width / 2;
  const positions = [x + 4 * scale, x + 74 * scale, x + half + 4 * scale, x + half + 78 * scale];
  values.forEach((value, index) => {
    if (!value) return;
    page.drawText(fit(value, index % 2 ? 27 : 19), {
      x: positions[index] ?? x,
      y: y - 10 * scale,
      size: 6 * scale,
      font: index % 2 ? bold : regular,
    });
  });
}
