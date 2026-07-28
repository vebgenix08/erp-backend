import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAuditLogRepository } from "../../audit-logs/audit-logs.repository";
import { InMemoryFirstAdminBootstrapRepository } from "../../bootstrap/bootstrap.repository";
import { createPlatformAdminContext } from "../../tenants/tests/fixtures";
import { InMemoryTenantRepository } from "../../tenants/tenants.repository";
import { provisionTenant } from "../provisioning.service";

function setup(failInvite=false){const tenants=new InMemoryTenantRepository();const bootstrap=new InMemoryFirstAdminBootstrapRepository();const auditLogs=new InMemoryAuditLogRepository();const context=createPlatformAdminContext();context.authContext!.user!.permissions.push("platform.bootstrap.create","platform.bootstrap.read");return{tenants,bootstrap,auditLogs,context,deps:{tenants,bootstrap:{repository:bootstrap,invitePort:{sendFirstAdminInvite:async()=>{if(failInvite)throw new Error("mail unavailable");return{inviteId:"invite-1",sentAt:new Date()}}}},auditLogs:{repository:auditLogs}}};}
const input={organizationName:"Northstar Academy",slug:"northstar-academy",primaryAdminFullName:"Asha Rao",primaryAdminEmail:"ASHA@EXAMPLE.COM",clientRequestId:"request-1"};

test("provisions tenant from four fields with server-owned code and invite",async()=>{const state=setup();const result=await provisionTenant(input,state.context,state.deps);const tenant=await state.tenants.getById(result.tenantId);assert.equal(result.organizationName,"Northstar Academy");assert.equal(result.slug,"northstar-academy");assert.equal(result.primaryAdminInviteStatus,"INVITED");assert.equal(tenant?.code,"TEN-NORTHSTARACADEMY");assert.equal(tenant?.contactEmail,"asha@example.com");assert.equal(tenant?.status,"ONBOARDING");assert.equal((await state.auditLogs.list()).length,1);});
test("retries same clientRequestId without duplicate tenant, bootstrap, or audit",async()=>{const state=setup();const first=await provisionTenant(input,state.context,state.deps);const second=await provisionTenant(input,state.context,state.deps);assert.equal(second.tenantId,first.tenantId);assert.equal((await state.tenants.list()).length,1);assert.equal((await state.bootstrap.list()).length,1);assert.equal((await state.auditLogs.list()).length,1);});
test("rejects duplicate slug for a different request",async()=>{const state=setup();await provisionTenant(input,state.context,state.deps);await assert.rejects(()=>provisionTenant({...input,clientRequestId:"request-2"},state.context,state.deps),/slug must be unique/i);});
test("invite failure preserves retryable onboarding tenant",async()=>{const state=setup(true);const result=await provisionTenant(input,state.context,state.deps);assert.equal(result.primaryAdminInviteStatus,"FAILED");assert.equal(result.warnings[0]?.code,"INVITE_FAILED");assert.equal((await state.tenants.list()).length,1);});
