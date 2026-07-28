export interface StudentNoteRecord {
  id: string;
  tenantId: string;
  studentId: string;
  body: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentNoteView {
  id: string;
  studentId: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
