import { ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import type {
  EmployeeListFilter,
  EmployeePage,
  EmployeeRecord,
} from "./employees.model";

interface EmployeeDocument extends EmployeeRecord { _id: string }
interface CounterDocument { _id: string; tenantId: string; sequence: number }

const clone = (value: EmployeeRecord): EmployeeRecord => ({
  ...value,
  campusIds: [...value.campusIds],
  pendingRoleIds: value.pendingRoleIds ? [...value.pendingRoleIds] : undefined,
  customFields: value.customFields ? structuredClone(value.customFields) : undefined,
  joiningDate: new Date(value.joiningDate),
  createdAt: new Date(value.createdAt),
  updatedAt: new Date(value.updatedAt),
  lastInviteAttemptAt: value.lastInviteAttemptAt ? new Date(value.lastInviteAttemptAt) : undefined,
  invitedAt: value.invitedAt ? new Date(value.invitedAt) : undefined,
  endedAt: value.endedAt ? new Date(value.endedAt) : undefined,
});

export interface EmployeeRepository {
  list(tenantId: string, filter?: EmployeeListFilter): Promise<EmployeeRecord[]>;
  listPage(tenantId: string, filter?: EmployeeListFilter): Promise<EmployeePage>;
  get(tenantId: string, id: string): Promise<EmployeeRecord | null>;
  findByEmail(tenantId: string, email: string): Promise<EmployeeRecord | null>;
  create(record: EmployeeRecord): Promise<EmployeeRecord>;
  update(tenantId: string, id: string, patch: Partial<EmployeeRecord>): Promise<EmployeeRecord | null>;
  nextCode(tenantId: string): Promise<string>;
}

const matches = (value: EmployeeRecord, filter: EmployeeListFilter) => {
  if (filter.status && value.status !== filter.status) return false;
  if (filter.loginStatus && value.loginStatus !== filter.loginStatus) return false;
  if (filter.staffCategory && value.staffCategory !== filter.staffCategory) return false;
  if (filter.campusId && !value.campusIds.includes(filter.campusId)) return false;
  const search = filter.search?.trim().toLowerCase();
  return !search || [
    value.fullName,
    value.email,
    value.phone,
    value.employeeCode,
    value.department,
    value.designation,
  ].some((item) => item?.toLowerCase().includes(search));
};

const sortRows = (rows: EmployeeRecord[], filter: EmployeeListFilter) => {
  const sortBy = filter.sortBy ?? "fullName";
  const direction = filter.sortDirection === "DESC" ? -1 : 1;
  return rows.sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const compared = leftValue instanceof Date && rightValue instanceof Date
      ? leftValue.getTime() - rightValue.getTime()
      : String(leftValue).localeCompare(String(rightValue));
    return compared === 0 ? left.id.localeCompare(right.id) : compared * direction;
  });
};

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly data = new Map<string, EmployeeRecord>();
  private readonly counters = new Map<string, number>();

  async list(tenantId: string, filter: EmployeeListFilter = {}) {
    return sortRows(
      [...this.data.values()].filter((value) => value.tenantId === tenantId && matches(value, filter)).map(clone),
      filter,
    );
  }

  async listPage(tenantId: string, filter: EmployeeListFilter = {}) {
    const rows = await this.list(tenantId, filter);
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const total = rows.length;
    const summaryRows = [...this.data.values()].filter((value) => value.tenantId === tenantId && (!filter.campusId || value.campusIds.includes(filter.campusId)));
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      sortBy: filter.sortBy ?? "fullName",
      sortDirection: filter.sortDirection ?? "ASC",
      summary: {
        total: summaryRows.length,
        active: summaryRows.filter((item) => item.status === "ACTIVE").length,
        teaching: summaryRows.filter((item) => item.status === "ACTIVE" && item.staffCategory === "TEACHING").length,
        nonTeaching: summaryRows.filter((item) => item.status === "ACTIVE" && item.staffCategory === "NON_TEACHING").length,
        loginReady: summaryRows.filter((item) => item.loginStatus === "ACTIVE").length,
        inviteIssues: summaryRows.filter((item) => item.loginStatus === "FAILED").length,
      },
    };
  }

  async get(tenantId: string, id: string) {
    const value = this.data.get(id);
    return value?.tenantId === tenantId ? clone(value) : null;
  }

  async findByEmail(tenantId: string, email: string) {
    const normalized = email.trim().toLowerCase();
    const value = [...this.data.values()].find((item) => item.tenantId === tenantId && item.email?.toLowerCase() === normalized);
    return value ? clone(value) : null;
  }

  async create(value: EmployeeRecord) {
    if (value.email && await this.findByEmail(value.tenantId, value.email)) throw new ConflictError("employee email already exists");
    this.data.set(value.id, clone(value));
    return clone(value);
  }

  async update(tenantId: string, id: string, patch: Partial<EmployeeRecord>) {
    const current = await this.get(tenantId, id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, tenantId: current.tenantId, updatedAt: new Date() };
    this.data.set(id, next);
    return clone(next);
  }

  async nextCode(tenantId: string) {
    const next = (this.counters.get(tenantId) ?? 0) + 1;
    this.counters.set(tenantId, next);
    return `EMP-${String(next).padStart(6, "0")}`;
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class MongoEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly employees: CollectionAdapter<EmployeeDocument>,
    private readonly counters: CollectionAdapter<CounterDocument>,
  ) {}

  private filter(tenantId: string, filter: EmployeeListFilter) {
    const query: Record<string, unknown> = { tenantId };
    if (filter.status) query.status = filter.status;
    if (filter.loginStatus) query.loginStatus = filter.loginStatus;
    if (filter.staffCategory) query.staffCategory = filter.staffCategory;
    if (filter.campusId) query.campusIds = filter.campusId;
    if (filter.search?.trim()) {
      const search = { $regex: escapeRegex(filter.search.trim()), $options: "i" };
      query.$or = ["fullName", "email", "phone", "employeeCode", "department", "designation"].map((field) => ({ [field]: search }));
    }
    return query;
  }

  private fromDocument(document: EmployeeDocument) {
    const { _id, ...value } = document;
    return clone({ ...value, id: value.id || _id });
  }

  async list(tenantId: string, filter: EmployeeListFilter = {}) {
    const sortBy = filter.sortBy ?? "fullName";
    const direction = filter.sortDirection === "DESC" ? -1 : 1;
    const rows = await this.employees.findMany(this.filter(tenantId, filter) as never, {
      sort: { [sortBy]: direction, _id: 1 } as never,
    });
    return rows.map((row) => this.fromDocument(row));
  }

  async listPage(tenantId: string, filter: EmployeeListFilter = {}) {
    const query = this.filter(tenantId, filter);
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const sortBy = filter.sortBy ?? "fullName";
    const sortDirection = filter.sortDirection ?? "ASC";
    const total = await this.employees.count(query as never);
    const rows = await this.employees.findMany(query as never, {
      sort: { [sortBy]: sortDirection === "ASC" ? 1 : -1, _id: 1 } as never,
      skip: (page - 1) * pageSize,
      limit: pageSize,
    });
    const summaryFilter: Record<string, unknown> = { tenantId };
    if (filter.campusId) summaryFilter.campusIds = filter.campusId;
    const [summaryTotal, active, teaching, nonTeaching, loginReady, inviteIssues] = await Promise.all([
      this.employees.count(summaryFilter as never),
      this.employees.count({ ...summaryFilter, status: "ACTIVE" } as never),
      this.employees.count({ ...summaryFilter, status: "ACTIVE", staffCategory: "TEACHING" } as never),
      this.employees.count({ ...summaryFilter, status: "ACTIVE", staffCategory: "NON_TEACHING" } as never),
      this.employees.count({ ...summaryFilter, loginStatus: "ACTIVE" } as never),
      this.employees.count({ ...summaryFilter, loginStatus: "FAILED" } as never),
    ]);
    return {
      items: rows.map((row) => this.fromDocument(row)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      sortBy,
      sortDirection,
      summary: { total: summaryTotal, active, teaching, nonTeaching, loginReady, inviteIssues },
    };
  }

  async get(tenantId: string, id: string) {
    const document = await this.employees.findOne({ tenantId, _id: id } as never);
    return document ? this.fromDocument(document) : null;
  }

  async findByEmail(tenantId: string, email: string) {
    const document = await this.employees.findOne({ tenantId, email: email.trim().toLowerCase() } as never);
    return document ? this.fromDocument(document) : null;
  }

  async create(value: EmployeeRecord) {
    if (value.email && await this.findByEmail(value.tenantId, value.email)) throw new ConflictError("employee email already exists");
    await this.employees.insertOne({ ...clone(value), _id: value.id });
    return clone(value);
  }

  async update(tenantId: string, id: string, patch: Partial<EmployeeRecord>) {
    const current = await this.get(tenantId, id);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, tenantId: current.tenantId, updatedAt: new Date() };
    return await this.employees.replaceOne({ tenantId, _id: id } as never, { ...next, _id: id }) ? clone(next) : null;
  }

  async nextCode(tenantId: string) {
    const id = `employee:${tenantId}`;
    const counter = await this.counters.findOneAndUpdate(
      { _id: id } as never,
      { $inc: { sequence: 1 }, $setOnInsert: { tenantId } },
      { upsert: true, returnDocument: "after" },
    );
    return `EMP-${String(counter?.sequence ?? 1).padStart(6, "0")}`;
  }
}

function runtimeEnv(): MongoEnvLike {
  return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
}

let singleton: Promise<EmployeeRepository> | undefined;
export async function createEmployeeRepository(env: MongoEnvLike = runtimeEnv()) {
  if (!env.MONGODB_URI && !env.MONGODB_URI_DEV && !env.MONGODB_URI_PROD && !env.MONGODB_URI_TEST) return new InMemoryEmployeeRepository();
  const employeeCollection = await getCollection<EmployeeDocument>("identity_employees", env);
  const counterCollection = await getCollection<CounterDocument>("identity_counters", env);
  await employeeCollection.createIndex({ tenantId: 1, employeeCode: 1 }, { unique: true });
  await employeeCollection.createIndex({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
  await employeeCollection.createIndex({ tenantId: 1, campusIds: 1, status: 1, fullName: 1 });
  return new MongoEmployeeRepository(
    createMongoCollectionAdapter(employeeCollection),
    createMongoCollectionAdapter(counterCollection),
  );
}

async function repository() {
  return singleton ??= createEmployeeRepository();
}

export const employeeRepository: EmployeeRepository = {
  list: async (...args) => (await repository()).list(...args),
  listPage: async (...args) => (await repository()).listPage(...args),
  get: async (...args) => (await repository()).get(...args),
  findByEmail: async (...args) => (await repository()).findByEmail(...args),
  create: async (...args) => (await repository()).create(...args),
  update: async (...args) => (await repository()).update(...args),
  nextCode: async (...args) => (await repository()).nextCode(...args),
};
