-- ============================================
-- Migration des chemins bank/ mal placés
-- ============================================
-- Contexte : avant commit 75db726, certains médias
-- pouvaient être créés avec un JSON hors dossier.
-- Ce script diagnostique puis corrige les chemins.

-- 1. DIAGNOSTIC : lister les .json hors dossier
SELECT id, filename, path, mimeType, size
FROM documents
WHERE path LIKE 'bank/%.json'
  AND path NOT LIKE 'bank/%/%.json'
ORDER BY path;

-- 2. DIAGNOSTIC : lister les .jpg/.jpeg/.png/.webp hors dossier
SELECT id, filename, path, mimeType, size
FROM documents
WHERE path LIKE 'bank/%.jpg'
   OR path LIKE 'bank/%.jpeg'
   OR path LIKE 'bank/%.png'
   OR path LIKE 'bank/%.webp'
  AND path NOT LIKE 'bank/%/%.jpg'
  AND path NOT LIKE 'bank/%/%.jpeg'
  AND path NOT LIKE 'bank/%/%.png'
  AND path NOT LIKE 'bank/%/%.webp'
ORDER BY path;

-- 3. DIAGNOSTIC : lister les documents sans sous-dossier
SELECT id, filename, path, mimeType, size
FROM documents
WHERE path LIKE 'bank/%'
  AND path NOT LIKE 'bank/%/%'
ORDER BY path;

-- 4. CORRECTION : déplacer bank/x.json -> bank/x/x.json
UPDATE documents
SET path = 'bank/' ||
           split_part(path, '/', 2) || '/' ||
           split_part(path, '/', 2) || '.json',
    filename = split_part(path, '/', 2) || '.json'
WHERE path LIKE 'bank/%.json'
  AND path NOT LIKE 'bank/%/%.json'
  AND split_part(path, '/', 2) != '';

-- 5. CORRECTION : déplacer bank/x.jpg -> bank/x/x.jpg
UPDATE documents
SET path = 'bank/' ||
           split_part(path, '/', 2) || '/' ||
           split_part(path, '/', 2) || '.jpg',
    filename = split_part(path, '/', 2) || '.jpg'
WHERE path LIKE 'bank/%.jpg'
  AND path NOT LIKE 'bank/%/%.jpg'
  AND split_part(path, '/', 2) != '';

-- 6. VÉRIFICATION après migration
SELECT id, filename, path, mimeType, size
FROM documents
WHERE path LIKE 'bank/%'
ORDER BY path;
