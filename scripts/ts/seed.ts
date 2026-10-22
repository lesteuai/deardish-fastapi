import { inArray } from 'drizzle-orm';
import { db } from '../../src/lib/server/db';
import { dishes, images } from '../../src/lib/server/db/schema';

export const seedImages = [
	{ id: '10000000-0000-4000-8000-000000000001', location: '/assets/dishes/tuscan-ribollita.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000002', location: '/assets/dishes/coq-au-vin.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000003', location: '/assets/dishes/miso-glazed-salmon.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000004', location: '/assets/dishes/chana-masala.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000005', location: '/assets/dishes/baja-fish-tacos.jpg', type: 'file' },
	{ id: '10000000-0000-4000-8000-000000000006', location: '/assets/dishes/thai-green-curry.jpg', type: 'file' }
];

export const seedDishes = [
	{
		name: 'Tuscan Ribollita',
		imageId: seedImages[0].id,
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
		imageId: seedImages[1].id,
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
		imageId: seedImages[2].id,
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
		imageId: seedImages[3].id,
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
		imageId: seedImages[4].id,
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
		imageId: seedImages[5].id,
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
	await db
		.insert(images)
		.values(seedImages)
		.onConflictDoNothing({ target: images.id });
	await db.insert(dishes).values(seedDishes);
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
	await seed();
	console.log(`Seeded ${seedDishes.length} dishes.`);
	process.exit(0);
}
