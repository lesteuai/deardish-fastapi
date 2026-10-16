import { dev } from '$app/environment';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';

let posthogLogProcessor: BatchLogRecordProcessor | null = null;

if (!PUBLIC_POSTHOG_PROJECT_TOKEN) {
	if (dev) {
		throw new Error(
			'PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured'
		);
	}
} else if (!PUBLIC_POSTHOG_HOST) {
	if (dev) {
		throw new Error(
			'PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_HOST is configured'
		);
	}
} else {
	posthogLogProcessor = new BatchLogRecordProcessor({
		exporter: new OTLPLogExporter({
			url: `${PUBLIC_POSTHOG_HOST}/i/v1/logs`,
			headers: { Authorization: `Bearer ${PUBLIC_POSTHOG_PROJECT_TOKEN}` }
		})
	});

	const sdk = new NodeSDK({
		resource: resourceFromAttributes({ 'service.name': 'deardish' }),
		logRecordProcessors: [posthogLogProcessor]
	});
	sdk.start();
}

export async function flushPostHogLogs(): Promise<void> {
	await posthogLogProcessor?.forceFlush();
}
