import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryClassRepository } from "../../classes/classes.repository";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { InMemorySectionRepository } from "../../sections/sections.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import { InMemoryCampusTransferRepository } from "../campus-transfers.repository";
import { approveCampusTransfer, cancelCampusTransfer, commitCampusTransfer, createCampusTransfer, listCampusTransferPage, retryCampusTransfer, updateCampusTransferWorkflow } from "../campus-transfers.service";

const tenantId = "tenant_academy";
const context: RequestContext = { requestId:"request_transfer",method:"POST",path:"graphql:createCampusTransfer",headers:{},query:{},body:{},params:{},tenantContext:{tenantId,source:"jwt-claims",resolvedAt:new Date()},authContext:{source:"jwt-claims",authenticatedAt:new Date(),user:{id:"admin_1",permissions:["academics.campus-transfer.create","academics.campus-transfer.read","academics.campus-transfer.approve","academics.campus-transfer.cancel"],source:"jwt-claims"}} };

async function dependencies() {
  const programs = new InMemoryProgramRepository();
  const classes = new InMemoryClassRepository();
  const sections = new InMemorySectionRepository();
  const students = new InMemoryStudentRepository();
  const repository = new InMemoryCampusTransferRepository();
  await programs.create(tenantId,{campusId:"campus_main",academicUnitId:"unit_cbse",name:"School",code:"SCHOOL-MAIN"});
  await programs.create(tenantId,{campusId:"campus_north",academicUnitId:"unit_cbse",name:"School",code:"SCHOOL-NORTH"});
  const sourceProgram=(await programs.list(tenantId,{campusId:"campus_main"}))[0]!;
  const targetProgram=(await programs.list(tenantId,{campusId:"campus_north"}))[0]!;
  await classes.create(tenantId,{campusId:"campus_main",programId:sourceProgram.id,name:"Class 6",code:"CLASS-006"});
  await classes.create(tenantId,{campusId:"campus_north",programId:targetProgram.id,name:"Class 6",code:"NORTH-006"});
  const sourceClass=(await classes.list(tenantId,{campusId:"campus_main"}))[0]!;
  const targetClass=(await classes.list(tenantId,{campusId:"campus_north"}))[0]!;
  await sections.create(tenantId,{campusId:"campus_north",programId:targetProgram.id,classId:targetClass.id,name:"Section A",code:"NORTH-A"});
  const targetSection=(await sections.list(tenantId,{campusId:"campus_north",classId:targetClass.id}))[0]!;
  const student=await students.createFromAdmission(tenantId,{admissionApplicationId:"application_1",admissionNumber:"ADM/26-27/0001",campusId:"campus_main",academicYearId:"year_2026",classId:sourceClass.id,studentName:"Aarav Sharma",phone:"9876543210",parentName:"Meera Sharma",confirmedBy:"admin_1",confirmedAt:"2026-06-01T00:00:00.000Z"},sourceProgram.id);
  return{repository,students,classes,sections,programs,student,targetClass,targetSection,numberIssuer:async(input:{stream:string})=>input.stream==="ROLL_NUMBER"?"06":"REG/26-27/000006",orchestrator:{start:async()=>({executionArn:"arn:aws:states:ap-south-1:123456789012:execution:campus-transfer:request"})}};
}

test("campus transfer request is idempotent and section scoped",async()=>{const deps=await dependencies();const input={studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Family relocated near the north campus",clientRequestId:"transfer-request-1"};const first=await createCampusTransfer(input,context,deps);const retry=await createCampusTransfer(input,context,deps);assert.equal(first.id,retry.id);assert.equal(first.status,"PROCESSING");assert.equal(first.registrationAction,"KEEP");assert.equal(first.target.sectionId,deps.targetSection.id)});
test("workflow commit switches only the approved enrollment and is retry safe",async()=>{const deps=await dependencies();const created=await createCampusTransfer({studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Approved campus transfer request",clientRequestId:"transfer-request-2"},context,deps);const completed=await commitCampusTransfer(tenantId,created.id,{destinationBalanceMinor:2000000},deps);assert.equal(completed.status,"COMPLETED");const student=await deps.students.getById(tenantId,deps.student.student.id);assert.equal(student?.enrollment.campusId,"campus_north");assert.equal(student?.enrollment.sectionId,deps.targetSection.id);const retry=await commitCampusTransfer(tenantId,created.id,undefined,deps);assert.equal(retry.status,"COMPLETED")});
test("finance review can be approved and restarted once",async()=>{const deps=await dependencies();const created=await createCampusTransfer({studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Finance reviewed campus transfer",clientRequestId:"transfer-request-review"},context,deps);await updateCampusTransferWorkflow(tenantId,created.id,"UNDER_REVIEW",{warning:"Additional charges require review"},deps);let approved=false;const result=await approveCampusTransfer(created.id,context,{...deps,orchestrator:{start:async(input)=>{approved=input.financeApproved;return{executionArn:"arn:approved"}}}});assert.equal(result.status,"PROCESSING");assert.equal(result.reviewedBy,"admin_1");assert.equal(approved,true);await assert.rejects(()=>approveCampusTransfer(created.id,context,deps),/under review/i)});
test("review queue is paged and a pending transfer can be cancelled",async()=>{const deps=await dependencies();const created=await createCampusTransfer({studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Cancelled campus transfer request",clientRequestId:"transfer-request-cancel"},context,deps);await updateCampusTransferWorkflow(tenantId,created.id,"UNDER_REVIEW",{},deps);const page=await listCampusTransferPage({status:"UNDER_REVIEW",page:1,pageSize:10},context,deps);assert.equal(page.total,1);const cancelled=await cancelCampusTransfer(created.id,"Parent withdrew the request",context,deps);assert.equal(cancelled.status,"CANCELLED");assert.equal(cancelled.history.at(-1)?.note,"Parent withdrew the request")});
test("failed campus transfer can be retried through a new workflow execution",async()=>{const deps=await dependencies();const created=await createCampusTransfer({studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Retryable campus transfer request",clientRequestId:"transfer-request-retry"},context,deps);await updateCampusTransferWorkflow(tenantId,created.id,"FAILED",{failureReason:"Temporary workflow failure"},deps);let financeApproved=true;const retried=await retryCampusTransfer(created.id,context,{...deps,orchestrator:{start:async input=>{financeApproved=input.financeApproved;return{executionArn:"arn:retry"}}}});assert.equal(retried.status,"PROCESSING");assert.equal(retried.executionArn,"arn:retry");assert.equal(financeApproved,false);assert.equal(retried.history.at(-1)?.note,"Workflow retry requested")});
test("failed workflow restart remains recoverable when orchestration cannot start",async()=>{const deps=await dependencies();const created=await createCampusTransfer({studentId:deps.student.student.id,targetCampusId:"campus_north",academicYearId:"year_2026",targetClassId:deps.targetClass.id,targetSectionId:deps.targetSection.id,effectiveAt:"2026-08-05T00:00:00.000Z",reason:"Recoverable campus transfer request",clientRequestId:"transfer-request-retry-failure"},context,deps);await updateCampusTransferWorkflow(tenantId,created.id,"FAILED",{failureReason:"Initial workflow failure"},deps);const retried=await retryCampusTransfer(created.id,context,{...deps,orchestrator:{start:async()=>{throw new Error("Step Functions unavailable")}}});assert.equal(retried.status,"FAILED");assert.equal(retried.failureReason,"Step Functions unavailable");assert.equal(retried.history.at(-1)?.note,"Workflow retry could not start")});

test("registration allocation reconciles imported-number collisions before transfer commit", async () => {
  const deps = await dependencies();
  await deps.programs.create(tenantId, { campusId: "campus_college", academicUnitId: "unit_degree", name: "Degree College", code: "DEGREE" });
  const targetProgram = (await deps.programs.list(tenantId, { campusId: "campus_college" }))[0]!;
  await deps.classes.create(tenantId, { campusId: "campus_college", programId: targetProgram.id, name: "First Year", code: "DEGREE-001" });
  const targetClass = (await deps.classes.list(tenantId, { campusId: "campus_college" }))[0]!;
  await deps.sections.create(tenantId, { campusId: "campus_college", programId: targetProgram.id, classId: targetClass.id, name: "Section A", code: "DEGREE-A" });
  const targetSection = (await deps.sections.list(tenantId, { campusId: "campus_college", classId: targetClass.id }))[0]!;
  const sourceProgram = (await deps.programs.list(tenantId, { campusId: "campus_main" }))[0]!;
  await deps.students.createFromAdmission(tenantId, { admissionApplicationId: "application_collision_1", admissionNumber: "ADM/26-27/0098", registrationNumber: "REG/26-27/000006", campusId: "campus_main", academicYearId: "year_2026", classId: deps.student.enrollment.classId, studentName: "Diya Rao", phone: "9876543298", parentName: "Kiran Rao", confirmedBy: "admin_1", confirmedAt: "2026-06-01T00:00:00.000Z" }, sourceProgram.id);
  const issuer = async (input: { stream: string; idempotencyKey: string }) => {
    if (input.stream === "ROLL_NUMBER") return "07";
    if (input.idempotencyKey.includes(":recovery:")) return input.idempotencyKey.endsWith(":0") ? "REG/26-27/000007" : "REG/26-27/000008";
    return input.idempotencyKey.endsWith(":0") ? "REG/26-27/000006" : "REG/26-27/000007";
  };
  const created = await createCampusTransfer({ studentId: deps.student.student.id, targetCampusId: "campus_college", academicYearId: "year_2026", targetClassId: targetClass.id, targetSectionId: targetSection.id, effectiveAt: "2026-08-05T00:00:00.000Z", reason: "Approved academic-unit campus movement", clientRequestId: "transfer-registration-reconciliation" }, context, { ...deps, numberIssuer: issuer });
  assert.equal(created.targetRegistrationNumber, "REG/26-27/000007");
  await deps.students.createFromAdmission(tenantId, { admissionApplicationId: "application_collision_2", admissionNumber: "ADM/26-27/0099", registrationNumber: "REG/26-27/000007", campusId: "campus_main", academicYearId: "year_2026", classId: deps.student.enrollment.classId, studentName: "Ishaan Rao", phone: "9876543299", parentName: "Nisha Rao", confirmedBy: "admin_1", confirmedAt: "2026-06-01T00:00:00.000Z" }, sourceProgram.id);

  const completed = await commitCampusTransfer(tenantId, created.id, undefined, { ...deps, numberIssuer: issuer });
  const movedStudent = await deps.students.getById(tenantId, deps.student.student.id);

  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.targetRegistrationNumber, "REG/26-27/000008");
  assert.equal(movedStudent?.student.registrationNumber, "REG/26-27/000008");
  assert.equal(movedStudent?.enrollment.sectionId, targetSection.id);
});
