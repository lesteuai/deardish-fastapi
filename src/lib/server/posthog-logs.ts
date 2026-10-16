import { logs } from '@opentelemetry/api-logs';
import { flushPostHogLogs } from './ai/telemetry';

type AdaptationLogStage =
	| 'configuration_missing'
	| 'generation_started'
	| 'generation_completed'
	| 'generation_failed';
type Severity = 'INFO' | 'WARN' | 'ERROR';

const posthogLogger = logs.getLogger('deardish.posthog-export');

export async function logDishAdaptation(stage: AdaptationLogStage, severity: Severity): Promise<void> {
	posthogLogger.emit({
		severityText: severity,
		body: `dish_adaptation_${stage}`,
		attributes: {
			'log.source': 'posthog_wizard',
			'adaptation.stage': stage
		}
	});
	await flushPostHogLogs();
}
