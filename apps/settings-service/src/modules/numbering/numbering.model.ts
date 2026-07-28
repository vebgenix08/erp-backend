import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type NumberingStream = "ENQUIRY" | "APPLICATION" | "ADMISSION" | "STUDENT_REGISTRATION" | "ROLL_NUMBER" | "EMPLOYEE" | "FEE_ORDER" | "INVOICE" | "PAYMENT" | "RECEIPT" | "BONAFIDE_CERTIFICATE" | "STUDY_CERTIFICATE" | "TRANSFER_CERTIFICATE" | "STUDENT_ID_CARD";
export type NumberingScope = "TENANT" | "CAMPUS" | "ACADEMIC_YEAR" | "PROGRAM" | "CLASS" | "SECTION";
export type NumberingReset = "NEVER" | "ACADEMIC_YEAR" | "CALENDAR_YEAR" | "MONTHLY";

export interface NumberingPolicyRecord {
  id: string; tenantId: string; stream: NumberingStream; name: string; format: string; prefix: string; separator: string; padding: number;
  scope: NumberingScope; reset: NumberingReset; nextNumber: number; active: boolean; issuedCount: number;
  createdAt: Date; updatedAt: Date;
}
export type NumberingPolicyInput = Pick<NumberingPolicyRecord, "stream" | "name" | "format" | "prefix" | "separator" | "padding" | "scope" | "reset" | "active">;
export interface NumberingPolicyView extends Omit<NumberingPolicyRecord, "createdAt" | "updatedAt"> { createdAt: string; updatedAt: string; sample: string; }
export interface NumberingServiceContext { tenantContext: TenantContext; authContext: AuthContext; requestId: string; }

export const DEFAULT_NUMBERING_POLICIES: NumberingPolicyInput[] = [
  { stream:"ENQUIRY",name:"Enquiry number",format:"ENQ/{YEAR}/{SEQUENCE}",prefix:"ENQ",separator:"/",padding:6,scope:"TENANT",reset:"ACADEMIC_YEAR",active:true },
  { stream:"APPLICATION",name:"Application number",format:"APP/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"APP",separator:"/",padding:6,scope:"TENANT",reset:"ACADEMIC_YEAR",active:true },
  { stream:"ADMISSION",name:"Admission number",format:"ADM/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"ADM",separator:"/",padding:6,scope:"TENANT",reset:"ACADEMIC_YEAR",active:true },
  { stream:"STUDENT_REGISTRATION",name:"Student registration number",format:"REG/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"REG",separator:"/",padding:6,scope:"CLASS",reset:"ACADEMIC_YEAR",active:true },
  { stream:"ROLL_NUMBER",name:"Section roll number",format:"{SEQUENCE}",prefix:"",separator:"",padding:2,scope:"SECTION",reset:"ACADEMIC_YEAR",active:true },
  { stream:"EMPLOYEE",name:"Employee number",format:"EMP/{SEQUENCE}",prefix:"EMP",separator:"/",padding:6,scope:"TENANT",reset:"NEVER",active:true },
  { stream:"FEE_ORDER",name:"Fee order number",format:"FEE/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"FEE",separator:"/",padding:6,scope:"TENANT",reset:"ACADEMIC_YEAR",active:true },
  { stream:"INVOICE",name:"Invoice number",format:"INV/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"INV",separator:"/",padding:6,scope:"TENANT",reset:"ACADEMIC_YEAR",active:true },
  { stream:"PAYMENT",name:"Payment reference",format:"PAY/{YEAR}/{SEQUENCE}",prefix:"PAY",separator:"/",padding:6,scope:"TENANT",reset:"CALENDAR_YEAR",active:true },
  { stream:"RECEIPT",name:"Receipt number",format:"RCP/{ACADEMIC_YEAR}/{SEQUENCE}",prefix:"RCP",separator:"/",padding:6,scope:"CAMPUS",reset:"ACADEMIC_YEAR",active:true },
  { stream:"BONAFIDE_CERTIFICATE",name:"Bonafide certificate",format:"BON/{YEAR}/{SEQUENCE}",prefix:"BON",separator:"/",padding:6,scope:"CAMPUS",reset:"CALENDAR_YEAR",active:true },
  { stream:"STUDY_CERTIFICATE",name:"Study certificate",format:"STU/{YEAR}/{SEQUENCE}",prefix:"STU",separator:"/",padding:6,scope:"CAMPUS",reset:"CALENDAR_YEAR",active:true },
  { stream:"TRANSFER_CERTIFICATE",name:"Transfer certificate",format:"TC/{YEAR}/{SEQUENCE}",prefix:"TC",separator:"/",padding:6,scope:"CAMPUS",reset:"CALENDAR_YEAR",active:true },
  { stream:"STUDENT_ID_CARD",name:"Student ID card",format:"IDC/{YEAR}/{SEQUENCE}",prefix:"IDC",separator:"/",padding:6,scope:"CAMPUS",reset:"CALENDAR_YEAR",active:true },
];
