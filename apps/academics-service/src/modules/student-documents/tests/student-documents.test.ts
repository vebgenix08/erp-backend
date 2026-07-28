import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryStudentRepository } from "../../students/students.repository";
import {
  getStudentDocument,
  issueStudentDocument,
  listStudentDocuments,
  revokeStudentDocument,
} from "../student-documents.service";
import { renderStudentDocumentPdf } from "../student-document-pdf";
import { InMemoryStudentDocumentRepository } from "../student-documents.repository";

const context = (tenantId = "tenant_greenfield"): RequestContext => ({
  requestId: "request_documents",
  method: "POST",
  path: "graphql:studentDocuments",
  headers: {},
  query: {},
  body: {},
  params: {},
  tenantContext: {
    tenantId,
    source: "jwt-claims",
    resolvedAt: new Date("2026-07-27T00:00:00.000Z"),
  },
  authContext: {
    source: "jwt-claims",
    authenticatedAt: new Date("2026-07-27T00:00:00.000Z"),
    user: {
      id: "user_administrator",
      source: "jwt-claims",
      permissions: [
        "academics.student-document.read",
        "academics.student-document.issue",
        "academics.student-document.revoke",
      ],
    },
  },
});

async function dependencies() {
  const repository = new InMemoryStudentDocumentRepository();
  const students = new InMemoryStudentRepository();
  const created = await students.createFromAdmission(
    "tenant_greenfield",
    {
      admissionApplicationId: "application_2026_001",
      admissionNumber: "ADM/2026/0001",
      studentName: "Aarav Sharma",
      parentName: "Meera Sharma",
      phone: "9876543210",
      campusId: "campus_central",
      academicYearId: "academic_year_2026",
      classId: "class_grade_8",
      sectionId: "section_a",
      confirmedAt: "2026-06-01T09:30:00.000Z",
      confirmedBy: "user_administrator",
    },
    "program_secondary",
  );
  return { repository, students, created };
}

test("issues sequential, tenant-isolated student documents", async () => {
  const deps = await dependencies();
  const now = () => new Date("2026-07-27T10:00:00.000Z");
  const first = await issueStudentDocument(
    {
      studentId: deps.created.student.id,
      documentType: "BONAFIDE_CERTIFICATE",
      purpose: "Scholarship application",
    },
    context(),
    { ...deps, now },
  );
  const second = await issueStudentDocument(
    {
      studentId: deps.created.student.id,
      documentType: "BONAFIDE_CERTIFICATE",
    },
    context(),
    { ...deps, now },
  );

  assert.equal(first.documentNumber, "BON/2026/000001");
  assert.equal(second.documentNumber, "BON/2026/000002");
  assert.equal((await listStudentDocuments({}, context(), deps)).length, 2);
  assert.equal(
    (await listStudentDocuments({}, context("tenant_riverside"), deps)).length,
    0,
  );
});

test("revokes an issued document without removing its audit record", async () => {
  const deps = await dependencies();
  const issued = await issueStudentDocument(
    {
      studentId: deps.created.student.id,
      documentType: "STUDENT_ID_CARD",
      validUntil: "2027-03-31",
    },
    context(),
    deps,
  );
  const revoked = await revokeStudentDocument(
    issued.id,
    "Replacement card issued",
    context(),
    deps,
  );

  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.revokeReason, "Replacement card issued");
  assert.equal((await getStudentDocument(issued.id, context(), deps)).status, "REVOKED");
});

test("renders valid PDF output for a certificate and an identity card", async () => {
  const deps = await dependencies();
  const branding = {
    institutionName: "Greenfield International School",
    campusName: "Central Campus",
    academicYearName: "2026-2027",
    className: "Grade 8",
    sectionName: "A",
  };

  for (const documentType of ["STUDY_CERTIFICATE", "STUDENT_ID_CARD"] as const) {
    const issued = await issueStudentDocument(
      { studentId: deps.created.student.id, documentType },
      context(),
      deps,
    );
    const stored = await deps.repository.getById(
      "tenant_greenfield",
      issued.id,
    );
    if (!stored) throw new Error("issued document was not persisted");
    const pdf = await renderStudentDocumentPdf(stored, branding);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
    assert.ok(pdf.length > 700);
  }
});
