import { describe, it, expect } from 'vitest';
import {
	buildAdaptSystemPrompt,
	buildAdaptUserPrompt,
	type Dish,
	type HealthProfile
} from './prompt';

const dish: Dish = {
	name: 'Paneer Butter Masala',
	cuisine: 'Indian',
	description: 'A creamy tomato curry with cubes of paneer.',
	ingredients: ['paneer', 'tomatoes', 'cream', 'butter', 'garam masala']
};

const emptyProfile: HealthProfile = {
	conditions: '',
	allergies: '',
	dietaryPreferences: '',
	notes: ''
};

describe('buildAdaptSystemPrompt', () => {
	it('provides DearDish recipe adaptation instructions', () => {
		const prompt = buildAdaptSystemPrompt();

			expect(prompt).toContain('DearDish');
			expect(prompt).toContain('complete, cookable recipe');
			expect(prompt).toContain('numbered cooking steps');
			expect(prompt).toContain('Changes from the original');
			expect(prompt).toContain('replaced, added, removed, or modified');
		});
});

describe('buildAdaptUserPrompt', () => {
	it('includes the dish name, cuisine, description, and every ingredient', () => {
		const prompt = buildAdaptUserPrompt(dish, emptyProfile);

		expect(prompt).toContain(dish.name);
		expect(prompt).toContain(dish.cuisine);
		expect(prompt).toContain(dish.description);
		for (const ingredient of dish.ingredients) {
			expect(prompt).toContain(ingredient);
		}
	});

	it('includes the value of every non-empty profile field', () => {
		const profile: HealthProfile = {
			conditions: 'type 2 diabetes',
			allergies: 'peanuts',
			dietaryPreferences: 'low carb',
			notes: 'avoid very spicy food'
		};

		const prompt = buildAdaptUserPrompt(dish, profile);

		expect(prompt).toContain('type 2 diabetes');
		expect(prompt).toContain('peanuts');
		expect(prompt).toContain('low carb');
		expect(prompt).toContain('avoid very spicy food');
	});

	it('omits the label of every empty profile field', () => {
		const profile: HealthProfile = {
			conditions: 'hypertension',
			allergies: '',
			dietaryPreferences: '',
			notes: ''
		};

		const prompt = buildAdaptUserPrompt(dish, profile);

		expect(prompt).toContain('Conditions: hypertension');
		expect(prompt).not.toContain('Allergies:');
		expect(prompt).not.toContain('Dietary preferences:');
		expect(prompt).not.toContain('Notes:');
	});

	it('falls back to general healthy-cooking guidance when every profile field is empty', () => {
		const prompt = buildAdaptUserPrompt(dish, emptyProfile);

		expect(prompt.toLowerCase()).toContain('healthy');
		expect(prompt).not.toContain('Conditions:');
		expect(prompt).not.toContain('Allergies:');
		expect(prompt).not.toContain('Dietary preferences:');
		expect(prompt).not.toContain('Notes:');
	});
});
