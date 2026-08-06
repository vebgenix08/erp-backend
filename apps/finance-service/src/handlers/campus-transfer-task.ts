import { feeOrderRepository } from "../modules/fee-orders/fee-orders.repository";
import { generateFeeOrderFromEnrollment } from "../modules/fee-orders/fee-orders.service";
import { hydrateFinanceRuntimeConfig } from "./runtime-config";

interface Location { campusId:string;academicYearId:string;programId:string;classId:string;sectionId?:string;enrollmentId:string }
interface Event {
  operation:"ASSESS_AND_APPLY"|"COMPENSATE";id:string;tenantId:string;studentId:string;studentName:string;
  admissionApplicationId:string;registrationNumber:string;source:Location;target:Location;requestedBy:string;financeApproved?:boolean;
}

export async function handler(event: Event) {
  await hydrateFinanceRuntimeConfig();
  const repository = await feeOrderRepository();
  const orders = await repository.list(event.tenantId, { studentId: event.studentId, academicYearId: event.target.academicYearId });
  if (event.operation === "COMPENSATE") {
    const destination = orders.find((item) => item.transferId === event.id && item.campusId === event.target.campusId);
    if (destination && destination.status !== "CANCELLED") {
      await repository.replace(event.tenantId, { ...destination, status: "CANCELLED", balanceMinor: 0, updatedAt: new Date() });
    }
    const source = orders.find((item) => item.transferId === event.id && item.campusId === event.source.campusId && item.closureReason === "CAMPUS_TRANSFER");
    if (source) {
      const { closedBalanceMinor: _closedBalance, closureReason: _closureReason, closedAt: _closedAt, transferId: _transferId, ...restored } = source;
      await repository.replace(event.tenantId, {
        ...restored,
        status: source.paidMinor === 0 ? "OPEN" : source.paidMinor >= source.totalMinor ? "PAID" : "PARTIALLY_PAID",
        balanceMinor: source.closedBalanceMinor ?? Math.max(0, source.totalMinor - source.paidMinor),
        updatedAt: new Date(),
      });
    }
    return { transferId: event.id, tenantId: event.tenantId, compensated: true };
  }
  const additional = orders.filter((item) => item.campusId === event.source.campusId && item.sourceType !== "ANNUAL" && !["CANCELLED", "CLOSED", "PAID"].includes(item.status) && item.balanceMinor > 0);
  if (additional.length && !event.financeApproved) {
    return { transferId:event.id,tenantId:event.tenantId,requiresReview:true,warning:"Additional source-campus charges require finance review",assessment:{additionalOrderIds:additional.map((item)=>item.id)} };
  }
  try {
    const order = await generateFeeOrderFromEnrollment({
      transferId:event.id,admissionApplicationId:event.admissionApplicationId,studentId:event.studentId,studentName:event.studentName,
      registrationNumber:event.registrationNumber,enrollmentId:event.target.enrollmentId,campusId:event.target.campusId,
      academicYearId:event.target.academicYearId,programId:event.target.programId,classId:event.target.classId,
      ...(event.target.sectionId ? { sectionId:event.target.sectionId } : {}),
      enrolledAt:new Date().toISOString(),createdBy:event.requestedBy,
    }, event.tenantId);
    const source = orders.find((item) => item.campusId === event.source.campusId && item.sourceType === "ANNUAL");
    return { transferId:event.id,tenantId:event.tenantId,requiresReview:false,assessment:{sourceOrderId:source?.id,sourceTotalMinor:source?.totalMinor??0,sourcePaidMinor:source?.paidMinor??0,sourceClosedBalanceMinor:source?.balanceMinor??0,destinationOrderId:order.id,destinationTotalMinor:order.totalMinor,transferCreditMinor:order.transferCreditMinor??0,destinationBalanceMinor:order.balanceMinor,residualTransferCreditMinor:order.residualTransferCreditMinor??0} };
  } catch (error) {
    if (error instanceof Error && /no active fee mapping/.test(error.message)) {
      return { transferId:event.id,tenantId:event.tenantId,requiresReview:true,warning:"Destination fee mapping is missing. Complete fee setup before approving this transfer.",assessment:{destinationMapping:"MISSING"} };
    }
    throw error;
  }
}
