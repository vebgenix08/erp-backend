export interface DomainEvent<TType extends string = string, TData = unknown> {
  id: string;
  type: TType;
  source: string;
  tenantId: string;
  occurredAt: string;
  correlationId?: string;
  data: TData;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface AdmissionConfirmedEventData {
  admissionApplicationId: string;
  admissionNumber: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string;
  studentName: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  phone: string;
  email?: string;
  address?: string;
  parentName: string;
  parentPhone?: string;
  parentRelation?: string;
  confirmedBy: string;
  confirmedAt: string;
}

export type AdmissionConfirmedEvent = DomainEvent<"admissions.admission.confirmed.v1", AdmissionConfirmedEventData>;

export interface StudentEnrolledEventData {
  admissionApplicationId: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  enrollmentId: string;
  campusId: string;
  academicYearId: string;
  programId: string;
  classId: string;
  sectionId?: string;
  enrolledAt: string;
  createdBy: string;
}

export type StudentEnrolledEvent = DomainEvent<"academics.student.enrolled.v1", StudentEnrolledEventData>;

export interface StudentEnrollmentChangedEventData extends StudentEnrolledEventData {
  previousEnrollmentId: string;
  reason: string;
}

export type StudentEnrollmentChangedEvent = DomainEvent<
  "academics.student.enrollment-changed.v1",
  StudentEnrollmentChangedEventData
>;

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}
export interface EventBridgePublisherOptions{eventBusName:string;region?:string;source?:string;}
export class EventBridgeEventPublisher implements EventPublisher {
  constructor(private readonly options: EventBridgePublisherOptions) {}

  async publish(event: DomainEvent) {
    const { EventBridgeClient, PutEventsCommand } = await import(
      "@aws-sdk/client-eventbridge"
    );
    const client = new EventBridgeClient(
      this.options.region ? { region: this.options.region } : {},
    ) as unknown as {
      send(command: unknown): Promise<{
        FailedEntryCount?: number;
        Entries?: Array<{ ErrorMessage?: string }>;
      }>;
    };
    const result = await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.options.eventBusName,
            Source: this.options.source ?? event.source,
            DetailType: event.type,
            Time: new Date(event.occurredAt),
            Detail: JSON.stringify(event),
          },
        ],
      }),
    );
    if ((result.FailedEntryCount ?? 0) > 0)
      throw new Error(
        result.Entries?.[0]?.ErrorMessage ??
          "EventBridge rejected the domain event",
      );
  }
}
export function createRuntimeEventPublisher(source:string):EventPublisher{const env=(globalThis as unknown as{process?:{env?:Record<string,string|undefined>}}).process?.env??{},eventBusName=env.EVENT_BUS_NAME?.trim();if(!eventBusName)throw new Error("EVENT_BUS_NAME is required");return new EventBridgeEventPublisher({eventBusName,source,...(env.AWS_REGION?{region:env.AWS_REGION}:{})});}
