import { CfnOutput, Stack, StackProps, aws_events as events } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface EventBridgeStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class EventBridgeStack extends Stack {
  public readonly bus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props);

    this.bus = new events.EventBus(this, 'Bus', {
      eventBusName: props.config.eventBusName,
    });

    new CfnOutput(this, 'EventBusArn', { value: this.bus.eventBusArn });
    new CfnOutput(this, 'EventBusName', { value: this.bus.eventBusName });
  }
}
