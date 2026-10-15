import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createTextStreamResponse, streamText } from 'ai';
import { buildAdaptPrompt, type Dish, type HealthProfile } from './prompt';
import { env } from '$env/dynamic/private';

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
		return errorResponse(MISSING_CONFIG_MESSAGE);
	}

	const openrouter = createOpenRouter({ apiKey });
	const result = streamText({
		model: openrouter.chat(model),
		prompt: buildAdaptPrompt(dish, profile)
	});

	const reader = result.stream.getReader();
	let firstChunk: string | null = null;

	try {
		while (firstChunk === null) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value.type === 'error') throw value.error;
			if (value.type === 'text-delta') firstChunk = value.text;
		}
	} catch {
		await reader.cancel().catch(() => {});
		return errorResponse(UNAVAILABLE_MESSAGE);
	}

	if (firstChunk === null) {
		await reader.cancel().catch(() => {});
		return errorResponse(UNAVAILABLE_MESSAGE);
	}

	const bufferedChunk = firstChunk;
	const stream = new ReadableStream<string>({
		start(controller) {
			controller.enqueue(bufferedChunk);
		},
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}
				if (value.type === 'error') throw value.error;
				if (value.type === 'text-delta') controller.enqueue(value.text);
			} catch (error) {
				controller.error(error);
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		}
	});

	return createTextStreamResponse({ stream });
}
