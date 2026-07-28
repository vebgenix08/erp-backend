export type ReceiptPaperSize = "A4" | "A5" | "THERMAL_80MM";

export interface ReceiptTemplateRecord {
  id: string;
  tenantId: string;
  title: string;
  headerText?: string;
  footerText?: string;
  signatureLabel: string;
  paperSize: ReceiptPaperSize;
  accentColor: string;
  showInstitutionLogo: boolean;
  showInstitutionAddress: boolean;
  showPaymentMethod: boolean;
  showPaymentReference: boolean;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReceiptTemplateInput = Omit<ReceiptTemplateRecord, "id" | "tenantId" | "updatedBy" | "createdAt" | "updatedAt">;

export interface ReceiptTemplateView extends Omit<ReceiptTemplateRecord, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}
