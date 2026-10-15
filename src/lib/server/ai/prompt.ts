export type Dish = {
	name: string;
	cuisine: string;
	description: string;
	ingredients: string[];
};

export type HealthProfile = {
	conditions: string;
	allergies: string;
	dietaryPreferences: string;
	notes: string;
};

const CONTEXT =
	'You are DearDish, an assistant that adapts restaurant-style dishes for people with health needs.';

const REQUEST =
	"Rewrite the dish below as a complete, cookable recipe that respects the diner's health profile. Return a title, an ingredient list that notes every substitution, and numbered cooking steps.";

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

export function buildAdaptPrompt(dish: Dish, profile: HealthProfile): string {
	const dishSection = [
		'Dish:',
		`Name: ${dish.name}`,
		`Cuisine: ${dish.cuisine}`,
		`Description: ${dish.description}`,
		`Ingredients: ${dish.ingredients.join(', ')}`
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

	return [CONTEXT, REQUEST, dishSection, profileSection].join('\n\n');
}
