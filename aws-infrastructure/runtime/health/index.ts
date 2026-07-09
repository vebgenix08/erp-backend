type HealthEvent = {
  requestContext?: {
    requestId?: string;
  };
};

export async function handler(event: HealthEvent = {}) {
  const service = process.env.SERVICE_NAME || 'unknown';
  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ok: true,
      service,
      environment: process.env.environment || 'unknown',
      region: process.env.DEPLOY_REGION || 'unknown',
      requestId: event.requestContext?.requestId || null,
    }),
  };
}
