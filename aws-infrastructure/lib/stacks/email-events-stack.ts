import {
  CfnOutput,
  Duration,
  Stack,
  type StackProps,
  aws_events as events,
  aws_events_targets as targets,
  aws_ses as ses,
  aws_sqs as sqs,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface EmailEventsStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class EmailEventsStack extends Stack {
  public readonly eventQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: EmailEventsStackProps) {
    super(scope, id, props);
    const defaultEventBus = events.EventBus.fromEventBusName(this, "DefaultEventBus", "default");

    const configurationSet = new ses.CfnConfigurationSet(this, "ConfigurationSet", {
      name: props.config.sesConfigurationSetName,
      reputationOptions: { reputationMetricsEnabled: true },
      sendingOptions: { sendingEnabled: true },
    });

    const destination = new ses.CfnConfigurationSetEventDestination(this, "EventDestination", {
      configurationSetName: props.config.sesConfigurationSetName,
      eventDestination: {
        name: `email-events-${props.config.environment}`,
        enabled: true,
        matchingEventTypes: ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "DELIVERY_DELAY", "RENDERING_FAILURE"],
        eventBridgeDestination: { eventBusArn: defaultEventBus.eventBusArn },
      },
    });
    destination.addDependency(configurationSet);

    this.deadLetterQueue = new sqs.Queue(this, "DeadLetterQueue", {
      queueName: `${props.config.emailEventsQueueName}-dlq`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      removalPolicy: props.config.removalPolicy,
    });

    this.eventQueue = new sqs.Queue(this, "EventQueue", {
      queueName: props.config.emailEventsQueueName,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 5 },
      removalPolicy: props.config.removalPolicy,
    });

    new events.Rule(this, "SesEmailEventsRule", {
      eventBus: defaultEventBus,
      ruleName: `ses-email-events-${props.config.environment}`,
      eventPattern: {
        source: ["aws.ses"],
        detailType: ["Email Sent", "Email Delivered", "Email Bounced", "Email Complaint Received", "Email Rejected", "Email Delivery Delayed", "Email Rendering Failed"],
      },
      targets: [new targets.SqsQueue(this.eventQueue, {
        deadLetterQueue: this.deadLetterQueue,
        retryAttempts: 2,
        maxEventAge: Duration.hours(2),
      })],
    });

    new CfnOutput(this, "ConfigurationSetName", { value: props.config.sesConfigurationSetName });
    new CfnOutput(this, "EmailEventsQueueUrl", { value: this.eventQueue.queueUrl });
    new CfnOutput(this, "EmailEventsDeadLetterQueueUrl", { value: this.deadLetterQueue.queueUrl });
  }
}
