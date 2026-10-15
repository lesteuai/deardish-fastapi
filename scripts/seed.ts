import { inArray } from 'drizzle-orm';
import { db } from '../src/lib/server/db';
import { dishes } from '../src/lib/server/db/schema';

export const seedDishes = [
	{
		name: 'Tuscan Ribollita',
		cuisine: 'Italian',
		description:
			'A hearty Tuscan bread and bean stew simmered with kale and tomatoes, finished with a swirl of olive oil.',
		ingredients: [
			'cannellini beans',
			'lacinato kale',
			'stale sourdough bread',
			'crushed tomatoes',
			'carrots',
			'celery',
			'yellow onion',
			'garlic',
			'extra virgin olive oil',
			'fresh rosemary'
		]
	},
	{
		name: 'Coq au Vin',
		cuisine: 'French',
		description:
			'Chicken braised low and slow in red wine with bacon lardons, mushrooms, and pearl onions.',
		ingredients: [
			'chicken thighs',
			'red wine',
			'bacon lardons',
			'pearl onions',
			'cremini mushrooms',
			'carrots',
			'garlic',
			'fresh thyme',
			'unsalted butter',
			'flour'
		]
	},
	{
		name: 'Miso Glazed Salmon',
		cuisine: 'Japanese',
		description:
			'Salmon fillets glazed with sweet white miso and mirin, roasted until caramelized and served over rice.',
		ingredients: [
			'salmon fillets',
			'white miso paste',
			'mirin',
			'brown sugar',
			'fresh ginger',
			'scallions',
			'toasted sesame seeds',
			'sushi rice'
		]
	},
	{
		name: 'Chana Masala',
		cuisine: 'Indian',
		description:
			'Tender chickpeas in a spiced tomato and onion masala, brightened with garam masala and fresh cilantro.',
		ingredients: [
			'chickpeas',
			'yellow onion',
			'tomatoes',
			'fresh ginger',
			'garlic',
			'garam masala',
			'ground cumin',
			'ground coriander',
			'turmeric',
			'green chili'
		]
	},
	{
		name: 'Baja Fish Tacos',
		cuisine: 'Mexican',
		description:
			'Lightly spiced grilled fish tucked into warm corn tortillas with cabbage slaw and chipotle crema.',
		ingredients: [
			'white fish fillets',
			'corn tortillas',
			'shredded cabbage',
			'lime',
			'fresh cilantro',
			'red onion',
			'avocado',
			'chipotle mayo',
			'ground cumin',
			'smoked paprika'
		]
	},
	{
		name: 'Thai Green Curry',
		cuisine: 'Thai',
		description:
			'A fragrant coconut curry with chicken, bamboo shoots, and Thai basil, balanced with fish sauce and lime.',
		ingredients: [
			'chicken breast',
			'green curry paste',
			'coconut milk',
			'Thai basil',
			'bamboo shoots',
			'red bell pepper',
			'fish sauce',
			'palm sugar',
			'kaffir lime leaves'
		]
	}
];

export async function seed() {
	const names = seedDishes.map((dish) => dish.name);
	await db.delete(dishes).where(inArray(dishes.name, names));
	await db.insert(dishes).values(seedDishes);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	await seed();
	console.log(`Seeded ${seedDishes.length} dishes.`);
	process.exit(0);
}
