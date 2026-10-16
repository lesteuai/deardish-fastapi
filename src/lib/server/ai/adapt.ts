import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createTextStreamResponse, streamText } from 'ai';
import { env } from '$env/dynamic/private';
import { logDishAdaptation } from '$lib/server/posthog-logs';
import { buildAdaptPrompt, type Dish, type HealthProfile } from './prompt';

const UNAVAILABLE_MESSAGE = 'The AI service is unavailable right now. Please try again shortly.';
const MISSING_CONFIG_MESSAGE = 'The AI service is not configured.';

function errorResponse(message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status: 502,
		headers: { 'content-type': 'application/json' }
	});
}

export async function createAdaptationResponse(
	dish: Dish,
	profile: HealthProfile
): Promise<Response> {
	const apiKey = env.AI_API_KEY;
	const model = env.AI_MODEL;
	if (!apiKey || !model) {
		await logDishAdaptation('configuration_missing', 'WARN');
		return errorResponse(MISSING_CONFIG_MESSAGE);
	}

	await logDishAdaptation('generation_started', 'INFO');
	const openrouter = createOpenRouter({ apiKey });
	const result = streamText({
		model: openrouter.chat(model),
		prompt: buildAdaptPrompt(dish, profile)
	});

	const reader = result.stream.getReader();
	const releaseAIStream = async (reason?: unknown) => {
		await reader.cancel(reason).catch(() => {});
	};
	let firstChunk: string | null = null;

	try {
		while (firstChunk === null) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value.type === 'error') throw value.error;
			if (value.type === 'text-delta') firstChunk = value.text;
		}
	} catch {
		await releaseAIStream();
		await logDishAdaptation('generation_failed', 'ERROR');
		return errorResponse(UNAVAILABLE_MESSAGE);
	}

	if (firstChunk === null) {
		await releaseAIStream();
		await logDishAdaptation('generation_failed', 'WARN');
		return errorResponse(UNAVAILABLE_MESSAGE);
	}

	const bufferedChunk = firstChunk;
	const stream = new ReadableStream<string>({
		start(controller) {
			controller.enqueue(bufferedChunk);
		},
		async pull(controller) {
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) {
						await logDishAdaptation('generation_completed', 'INFO');
						controller.close();
						return;
					}
					if (value.type === 'error') throw value.error;
					if (value.type === 'text-delta') {
						controller.enqueue(value.text);
						return;
					}
				}
			} catch (error) {
				await logDishAdaptation('generation_failed', 'ERROR');
				controller.error(error);
			}
		},
		async cancel(reason) {
			await releaseAIStream(reason);
		}
	});

	return createTextStreamResponse({ stream });
}
