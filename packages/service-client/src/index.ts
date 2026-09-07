import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { RequestContext } from "@school-erp/api";
import type { AuthRoleAssignment, Permission } from "@school-erp/auth";
import type { NumberingContext, NumberingGateway } from "@school-erp/numbering";

export interface InternalServiceRequest<TPayload = unknown> {
  source?: "erp.internal";
  operation: string;
  payload: TPayload;
}

export interface InternalServiceResponse<TResult = unknown> {
  result?: TResult;
  error?: string;
}

export interface AuthorizationSnapshot {
  userId: string;
  principalId: string;
  role?: string;
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  scopes: AuthRoleAssignment[];
}

export interface InternalServiceInvoker {
  invoke<TPayload, TResult>(
    functionName: string,
    request: InternalServiceRequest<TPayload>,
  ): Promise<TResult>;
}

export class LambdaServiceInvoker implements InternalServiceInvoker {
  constructor(private readonly client = new LambdaClient({})) {}

  async invoke<TPayload, TResult>(
    functionName: string,
    request: InternalServiceRequest<TPayload>,
  ): Promise<TResult> {
    if (!functionName.trim()) throw new Error("internal service function name is required");
    const response = await this.client.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: "RequestResponse",
        Payload: new TextEncoder().encode(JSON.stringify({ source: "erp.internal", ...request })),
      }),
    );
    if (!response.Payload?.length) {
      throw new Error("internal service returned no payload");
    }
    const decoded = JSON.parse(
      new TextDecoder().decode(response.Payload),
    ) as InternalServiceResponse<TResult>;
    if (response.FunctionError || decoded.error) {
      throw new Error(decoded.error ?? "internal service invocation failed");
    }
    if (!("result" in decoded)) throw new Error("internal service returned no result");
    return decoded.result as TResult;
  }
}

function runtimeEnv() {
  return (
    (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

let defaultInvoker: InternalServiceInvoker | undefined;

export function internalServiceInvoker() {
  return (defaultInvoker ??= new LambdaServiceInvoker());
}

export async function hydrateConfiguredAuthorization(
  context: RequestContext,
  invoker: InternalServiceInvoker = internalServiceInvoker(),
): Promise<RequestContext> {
  const functionName = runtimeEnv().IDENTITY_FUNCTION_NAME?.trim();
  const tenantId = context.tenantContext?.tenantId;
  const user = context.authContext?.user;
  if (!functionName || !tenantId || !user) return context;

  const snapshot = await invoker.invoke<
    { tenantId: string; principalId: string },
    AuthorizationSnapshot | null
  >(functionName, {
    operation: "RESOLVE_AUTHORIZATION",
    payload: {
      tenantId,
      principalId: user.id,
    },
  });

  context.authContext!.user = snapshot
    ? {
        ...user,
        role: snapshot.role,
        roles: snapshot.roles,
        scopes: snapshot.scopes,
        permissions: snapshot.permissions as Permission[],
      }
    : { ...user, role: undefined, roles: [], scopes: [], permissions: [] };
  return context;
}

export class ServiceNumberingGateway implements NumberingGateway {
  constructor(
    private readonly functionName: string,
    private readonly invoker: InternalServiceInvoker = internalServiceInvoker(),
  ) {}

  issue(context: NumberingContext): Promise<string> {
    return this.invoker.invoke(this.functionName, {
      operation: "ISSUE_NUMBER",
      payload: serializeNumberingContext(context),
    });
  }

  issueBatch(contexts: NumberingContext[]): Promise<string[]> {
    return this.invoker.invoke(this.functionName, {
      operation: "ISSUE_NUMBER_BATCH",
      payload: contexts.map(serializeNumberingContext),
    });
  }

  cancel(
    context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
    reason: string,
  ): Promise<string> {
    return this.invoker.invoke(this.functionName, {
      operation: "CANCEL_NUMBER",
      payload: { context, reason },
    });
  }
}

let numberingGateway: NumberingGateway | undefined;

export function configureNumberingGateway(gateway: NumberingGateway | undefined) {
  numberingGateway = gateway;
}

function resolvedNumberingGateway() {
  if (numberingGateway) return numberingGateway;
  const functionName = runtimeEnv().NUMBERING_FUNCTION_NAME?.trim();
  if (!functionName) throw new Error("NUMBERING_FUNCTION_NAME is not configured");
  return (numberingGateway = new ServiceNumberingGateway(functionName));
}

export function issueConfiguredNumber(context: NumberingContext) {
  return resolvedNumberingGateway().issue(context);
}

export async function issueConfiguredNumbers(contexts: NumberingContext[]) {
  if (!contexts.length) return [];
  const gateway = resolvedNumberingGateway();
  if (gateway instanceof ServiceNumberingGateway) return gateway.issueBatch(contexts);
  const numbers: string[] = [];
  for (const context of contexts) numbers.push(await gateway.issue(context));
  return numbers;
}

export function cancelConfiguredNumber(
  context: Pick<NumberingContext, "tenantId" | "stream" | "idempotencyKey">,
  reason: string,
) {
  return resolvedNumberingGateway().cancel(context, reason);
}

function serializeNumberingContext(context: NumberingContext) {
  return {
    ...context,
    ...(context.at ? { at: context.at.toISOString() } : {}),
  };
}
