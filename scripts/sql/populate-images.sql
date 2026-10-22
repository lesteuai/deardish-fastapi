BEGIN;

INSERT INTO images (id, location, type) VALUES
	('10000000-0000-4000-8000-000000000001', '/assets/dishes/tuscan-ribollita.jpg', 'file'),
	('10000000-0000-4000-8000-000000000002', '/assets/dishes/coq-au-vin.jpg', 'file'),
	('10000000-0000-4000-8000-000000000003', '/assets/dishes/miso-glazed-salmon.jpg', 'file'),
	('10000000-0000-4000-8000-000000000004', '/assets/dishes/chana-masala.jpg', 'file'),
	('10000000-0000-4000-8000-000000000005', '/assets/dishes/baja-fish-tacos.jpg', 'file'),
	('10000000-0000-4000-8000-000000000006', '/assets/dishes/thai-green-curry.jpg', 'file')
ON CONFLICT (id) DO UPDATE
SET location = EXCLUDED.location, type = EXCLUDED.type;

UPDATE dishes AS dish
SET image_id = image.id
FROM images AS image
JOIN (VALUES
	('Tuscan Ribollita', '10000000-0000-4000-8000-000000000001'::uuid),
	('Coq au Vin', '10000000-0000-4000-8000-000000000002'::uuid),
	('Miso Glazed Salmon', '10000000-0000-4000-8000-000000000003'::uuid),
	('Chana Masala', '10000000-0000-4000-8000-000000000004'::uuid),
	('Baja Fish Tacos', '10000000-0000-4000-8000-000000000005'::uuid),
	('Thai Green Curry', '10000000-0000-4000-8000-000000000006'::uuid)
) AS mapping(name, image_id) ON image.id = mapping.image_id
WHERE dish.name = mapping.name;

COMMIT;
