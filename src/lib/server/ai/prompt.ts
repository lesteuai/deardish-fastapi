export type Dish = {
	name: string;
	cuisine: string;
	description: string;
	ingredients: string[];
	content: string;
};

export type HealthProfile = {
	conditions: string;
	allergies: string;
	dietaryPreferences: string;
	notes: string;
};

const SYSTEM_PROMPT = [
	'You are DearDish, an assistant that adapts restaurant-style dishes for people with health needs.',
	[
		"Rewrite the provided dish as a complete, cookable recipe that respects the diner's health profile. Format the response in Markdown with these sections, in this order:",
		'1. Recipe title and a one-sentence description.',
		'2. Recipe details: servings, prep time, and cook time. If a value is uncertain, give a reasonable estimate.',
		'3. Ingredients: list quantities and ingredients in the order used. Name substitutions clearly beside the adapted ingredient.',
		'4. Instructions: provide concise numbered cooking steps with temperatures, timings, and doneness cues where useful.',
		'5. Changes from the original: list each ingredient or preparation change, stating what was replaced, added, removed, or modified and the reason. Mention only changes that were actually made. If nothing changed, say so. Base this comparison on the supplied dish name, description, and ingredients. Do not imply that the original included quantities or preparation details that were not provided. Keep the dish recognizable and flavorful.',
		'Bolden any changes from the original recipe.'
	].join('\n')
].join('\n\n');

export const ORIGINAL_RECIPE_FORMAT_PROMPT = [
	'Format the supplied source recipe as the dish’s original recipe. Preserve the source recipe and do not adapt it to a health profile or change its ingredients or cooking method.',
	'Return only Markdown using this structure:',
	'## {Recipe name}',
	'',
	'**Serves {yield} | Prep {prep time} | Cook {cook time}**',
	'',
	'### Ingredients',
	'- List ingredients with source quantities, in the order used.',
	'',
	'### Method',
	'1. Present the original method as concise, numbered, cookable steps. Preserve temperatures, timings, and doneness cues from the source.',
	'',
	'Recipe reference: {source URL}',
	'',
	'Use metadata only when it is provided by the source; write “Not specified” for missing yield or times instead of guessing. Do not invent ingredient amounts, steps, temperatures, timings, or a source URL. Keep essential recipe details intact while paraphrasing instructions instead of copying source wording verbatim.'
].join('\n');

const EMPTY_PROFILE_FALLBACK = [
	'No health profile was provided, so apply general healthy-cooking guidance:',
	'- Lower sodium by seasoning with herbs, spices, citrus, and vinegar instead of added salt.',
	'- Cut added sugar and refined carbohydrates, favoring whole grains.',
	'- Use wholesome swaps like olive oil for butter and lean proteins where possible.',
	'- Keep the restaurant-style flavor and presentation.'
].join('\n');

function labelledLine(label: string, value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? `${label}: ${trimmed}` : null;
}

export function buildAdaptSystemPrompt(): string {
	return SYSTEM_PROMPT;
}

export function buildAdaptUserPrompt(dish: Dish, profile: HealthProfile): string {
	const dishSection = [
		'Dish:',
		`Name: ${dish.name}`,
		`Cuisine: ${dish.cuisine}`,
		`Description: ${dish.description}`,
		`Ingredients: ${dish.ingredients.join(', ')}`,
		`Content: ${dish.content}`,
	].join('\n');

	const profileLines = [
		labelledLine('Conditions', profile.conditions),
		labelledLine('Allergies', profile.allergies),
		labelledLine('Dietary preferences', profile.dietaryPreferences),
		labelledLine('Notes', profile.notes)
	].filter((line): line is string => line !== null);

	const profileSection =
		profileLines.length > 0
			? ['Health profile:', ...profileLines].join('\n')
			: ['Health profile:', EMPTY_PROFILE_FALLBACK].join('\n');
	
	return [dishSection, profileSection].join('\n\n');
}
