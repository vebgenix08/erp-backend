import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthFromRequest } from "@school-erp/auth";
import { ConflictError, ValidationError } from "@school-erp/errors";
import { InMemoryEventPublisher } from "@school-erp/events";
import { resolveTenantFromRequest } from "@school-erp/tenancy";
import { InMemoryApplicationRepository } from "../application.repository";
import {
  approveApplication,
  cancelApplication,
  checkApplicationDuplicates,
  confirmApplication,
  createApplication,
  listApplicationPage,
  listApplications,
  rejectApplication,
  submitApplication,
  updateApplication,
} from "../application.service";

const allPermissions =
  "admissions.application.read admissions.application.create admissions.application.update admissions.application.approve admissions.admission.confirm";
function context(tenantId = "tenant_alpha") {
  const request = {
    requestId: "request_1",
    headers: {
      "x-user-id": "admission_officer_1",
      "x-user-permissions": allPermissions,
      "x-tenant-id": tenantId,
    },
  };
  return {
    tenantContext: resolveTenantFromRequest(request),
    authContext: resolveAuthFromRequest(request),
    requestId: request.requestId,
  };
}
function input(overrides: Record<string, unknown> = {}) {
  return {
    campusId: "campus_main",
    academicYearId: "2026-2027",
    academicTargetId: "class_10",
    studentName: "Aarav Sharma",
    phone: "+919876543210",
    parentName: "Meera Sharma",
    templateId: "admission_template",
    templateVersion: 4,
    documents: [],
    ...overrides,
  };
}

test("application remains an unnumbered tenant-scoped draft until submission", async () => {
  const repository = new InMemoryApplicationRepository();
  const created = await createApplication(
    input({
      customFields: { bloodGroup: "O+" },
      documents: [
        {
          fileId: "file_birth",
          documentType: "BIRTH_CERTIFICATE",
          fileName: "birth-certificate.pdf",
        },
      ],
    }),
    context(),
    { repository },
  );
  assert.equal(created.status, "DRAFT");
  assert.equal(created.applicationNumber, undefined);
  assert.equal(created.tenantId, "tenant_alpha");
  assert.equal(created.templateVersion, 4);
  assert.equal(created.documents[0]?.fileId, "file_birth");
  const submitted = await submitApplication(created.id, context(), {
    repository,
  });
  assert.equal(submitted.status, "SUBMITTED");
  assert.equal(submitted.applicationNumber, "APP/26-27/0001");
  assert.equal(submitted.stageHistory.length, 2);
});

test("application pages expose filtered totals and remain tenant isolated", async () => {
  const repository = new InMemoryApplicationRepository();
  for (let index = 1; index <= 12; index += 1) {
    await createApplication(
      input({ studentName: `Applicant ${String(index).padStart(2, "0")}` }),
      context(),
      { repository },
    );
  }
  await createApplication(
    input({ studentName: "Other Tenant Applicant" }),
    context("tenant_other"),
    { repository },
  );

  const first = await listApplicationPage(context(), { repository }, {
    page: 1,
    pageSize: 10,
    search: "Applicant",
  });
  const second = await listApplicationPage(context(), { repository }, {
    page: 2,
    pageSize: 10,
    search: "Applicant",
  });

  assert.equal(first.total, 12);
  assert.equal(first.totalPages, 2);
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 2);
  assert.ok(first.items.every((item) => item.tenantId === "tenant_alpha"));
});

test("submission resolves and snapshots the Settings-owned academic year code", async () => {
  const repository = new InMemoryApplicationRepository();
  const created = await createApplication(
    input({ academicYearId: "academic_year_8f18a2" }),
    context(),
    { repository },
  );
  const submitted = await submitApplication(created.id, context(), {
    repository,
    academicYears: {
      getCode: async (tenantId, academicYearId) => {
        assert.equal(tenantId, "tenant_alpha");
        assert.equal(academicYearId, "academic_year_8f18a2");
        return "26-27";
      },
    },
  });
  assert.equal(submitted.applicationNumber, "APP/26-27/0001");
  assert.equal(submitted.academicYearCode, "26-27");
});

test("application numbers increment independently for each tenant and academic year", async () => {
  const repository = new InMemoryApplicationRepository();
  const first = await createApplication(
    input({ studentName: "Aarav Sharma" }),
    context("tenant_alpha"),
    { repository },
  );
  const second = await createApplication(
    input({ studentName: "Diya Nair" }),
    context("tenant_alpha"),
    { repository },
  );
  const other = await createApplication(
    input({ studentName: "Kabir Khan" }),
    context("tenant_beta"),
    { repository },
  );
  assert.equal(
    (await submitApplication(first.id, context("tenant_alpha"), { repository }))
      .applicationNumber,
    "APP/26-27/0001",
  );
  assert.equal(
    (
      await submitApplication(second.id, context("tenant_alpha"), {
        repository,
      })
    ).applicationNumber,
    "APP/26-27/0002",
  );
  assert.equal(
    (await submitApplication(other.id, context("tenant_beta"), { repository }))
      .applicationNumber,
    "APP/26-27/0001",
  );
});

test("only drafts can be edited and only submitted applications can be reviewed", async () => {
  const repository = new InMemoryApplicationRepository(),
    created = await createApplication(input(), context(), { repository });
  const edited = await updateApplication(
    created.id,
    { parentName: "Arun Sharma" },
    context(),
    { repository },
  );
  assert.equal(edited.parentName, "Arun Sharma");
  await assert.rejects(
    () => approveApplication(created.id, {}, context(), { repository }),
    ConflictError,
  );
  await submitApplication(created.id, context(), { repository });
  await assert.rejects(
    () =>
      updateApplication(created.id, { studentName: "Changed" }, context(), {
        repository,
      }),
    ConflictError,
  );
  const approved = await approveApplication(
    created.id,
    { remarks: "Documents verified" },
    context(),
    { repository },
  );
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.reviews[0]?.remarks, "Documents verified");
  assert.equal(approved.approvedBy, "admission_officer_1");
});

test("rejection requires a reason and records immutable review history", async () => {
  const repository = new InMemoryApplicationRepository(),
    created = await createApplication(input(), context(), { repository });
  await submitApplication(created.id, context(), { repository });
  await assert.rejects(
    () => rejectApplication(created.id, {}, context(), { repository }),
    ValidationError,
  );
  const rejected = await rejectApplication(
    created.id,
    { reason: "Eligibility documents are incomplete" },
    context(),
    { repository },
  );
  assert.equal(rejected.status, "REJECTED");
  assert.equal(
    rejected.rejectionReason,
    "Eligibility documents are incomplete",
  );
  assert.equal(rejected.reviews.length, 1);
});

test("one enquiry cannot produce multiple active applications", async () => {
  const repository = new InMemoryApplicationRepository();
  await createApplication(input({ enquiryId: "enquiry_1" }), context(), {
    repository,
  });
  await assert.rejects(
    () =>
      createApplication(
        input({ enquiryId: "enquiry_1", studentName: "Another Name" }),
        context(),
        { repository },
      ),
    ConflictError,
  );
});

test("listing never crosses tenant boundaries and cancellation records its reason", async () => {
  const repository = new InMemoryApplicationRepository();
  const alpha = await createApplication(input(), context("tenant_alpha"), {
    repository,
  });
  await createApplication(
    input({ studentName: "Diya Nair" }),
    context("tenant_beta"),
    { repository },
  );
  assert.equal(
    (await listApplications(context("tenant_alpha"), { repository })).length,
    1,
  );
  const cancelled = await cancelApplication(
    alpha.id,
    { reason: "Applicant requested cancellation" },
    context("tenant_alpha"),
    { repository },
  );
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(
    cancelled.cancellationReason,
    "Applicant requested cancellation",
  );
});

test("confirmation assigns an admission number and publishes one integration event", async () => {
  const repository = new InMemoryApplicationRepository();
  const publisher = new InMemoryEventPublisher();
  const created = await createApplication(input(), context(), { repository });
  await submitApplication(created.id, context(), { repository });
  await approveApplication(
    created.id,
    { remarks: "Eligibility verified" },
    context(),
    { repository },
  );

  const confirmed = await confirmApplication(created.id, {}, context(), {
    repository,
    eventPublisher: publisher,
  });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.admissionNumber, "ADM/26-27/0001");
  assert.equal(publisher.events.length, 1);
  assert.equal(publisher.events[0]?.type, "admissions.admission.confirmed.v1");
  assert.equal(publisher.events[0]?.tenantId, "tenant_alpha");

  const retried = await confirmApplication(created.id, {}, context(), {
    repository,
    eventPublisher: publisher,
  });
  assert.equal(retried.admissionNumber, confirmed.admissionNumber);
  assert.equal(publisher.events.length, 1);
  assert.equal(
    (await repository.getById("tenant_alpha", created.id))?.pendingEvents
      .length,
    0,
  );
});

test("confirmation retains the event when publishing fails", async () => {
  const repository = new InMemoryApplicationRepository();
  const created = await createApplication(input(), context(), { repository });
  await submitApplication(created.id, context(), { repository });
  await approveApplication(created.id, {}, context(), { repository });

  await assert.rejects(
    () =>
      confirmApplication(created.id, {}, context(), {
        repository,
        eventPublisher: {
          publish: async () => {
            throw new Error("event bus unavailable");
          },
        },
      }),
    /event bus unavailable/,
  );

  const stored = await repository.getById("tenant_alpha", created.id);
  assert.equal(stored?.status, "CONFIRMED");
  assert.equal(stored?.pendingEvents.length, 1);

  const publisher = new InMemoryEventPublisher();
  await confirmApplication(created.id, {}, context(), {
    repository,
    eventPublisher: publisher,
  });
  assert.equal(publisher.events.length, 1);
  assert.equal(
    (await repository.getById("tenant_alpha", created.id))?.pendingEvents
      .length,
    0,
  );
});

test("potential duplicates require an explicit reviewed acknowledgement", async () => {
  const repository = new InMemoryApplicationRepository();
  const original = await createApplication(
    input({
      studentName: "Aarav Sharma",
      phone: "+91 98765 43210",
      email: "aarav@example.edu",
    }),
    context(),
    { repository },
  );
  await submitApplication(original.id, context(), { repository });
  await approveApplication(original.id, {}, context(), { repository });
  await confirmApplication(original.id, {}, context(), { repository });

  const duplicate = await createApplication(
    input({
      studentName: "Aarav S Sharma",
      phone: "9876543210",
      email: "aarav@example.edu",
    }),
    context(),
    { repository },
  );
  await submitApplication(duplicate.id, context(), { repository });
  await approveApplication(duplicate.id, {}, context(), { repository });
  const check = await checkApplicationDuplicates(duplicate.id, context(), {
    repository,
  });
  assert.equal(check.hasPotentialDuplicates, true);
  assert.deepEqual(check.matches[0]?.reasons, ["PHONE", "EMAIL"]);
  await assert.rejects(
    () => confirmApplication(duplicate.id, {}, context(), { repository }),
    ConflictError,
  );
  const confirmed = await confirmApplication(
    duplicate.id,
    { duplicateReviewAcknowledged: true },
    context(),
    { repository },
  );
  assert.equal(confirmed.status, "CONFIRMED");
});
