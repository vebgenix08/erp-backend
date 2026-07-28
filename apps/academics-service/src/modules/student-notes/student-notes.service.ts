import type { RequestContext } from "@school-erp/api";
import { BadRequestError, NotFoundError } from "@school-erp/errors";
import type { StudentNoteRepository } from "./student-notes.repository";
import { getStudentNoteRepository } from "./student-notes.repository";

const body = (input: unknown) => {
  if (typeof input !== "string" || !input.trim()) throw new BadRequestError("note body is required");
  if (input.trim().length > 2000) throw new BadRequestError("note body cannot exceed 2000 characters");
  return input.trim();
};
const view = (record: Awaited<ReturnType<StudentNoteRepository["create"]>>) => ({
  ...record,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId;
  if (!value) throw new BadRequestError("tenant context is required");
  return value;
};
const userId = (context: RequestContext) => {
  const value = context.authContext?.user?.id;
  if (!value) throw new BadRequestError("authenticated user is required");
  return value;
};

export async function listStudentNotes(studentId: string, context: RequestContext, repository?: StudentNoteRepository) {
  const repo = repository ?? await getStudentNoteRepository();
  return (await repo.list(tenantId(context), studentId)).map(view);
}
export async function createStudentNote(studentId: string, input: Record<string, unknown>, context: RequestContext, repository?: StudentNoteRepository) {
  const repo = repository ?? await getStudentNoteRepository();
  const now = new Date();
  return view(await repo.create({
    id: `student_note_${crypto.randomUUID()}`,
    tenantId: tenantId(context),
    studentId,
    body: body(input.body),
    createdBy: userId(context),
    createdAt: now,
    updatedAt: now,
  }));
}
export async function updateStudentNote(id: string, input: Record<string, unknown>, context: RequestContext, repository?: StudentNoteRepository) {
  const repo = repository ?? await getStudentNoteRepository();
  const updated = await repo.update(tenantId(context), id, body(input.body), new Date());
  if (!updated) throw new NotFoundError("student note not found");
  return view(updated);
}
