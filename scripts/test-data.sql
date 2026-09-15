-- Insert test data for dashboard validation
INSERT INTO "SystemVersion" (id, version, "publishedAt", "publishedBy", changelog, "fileCount") VALUES (
  'test-version-1',
  'v-test-' || EXTRACT(EPOCH FROM NOW())::text,
  NOW(),
  'admin@nexaflow.local',
  'Test de validation du dashboard',
  3
);

INSERT INTO "PublishQueue" (id, path, "textContent", hash, size, version, "publishedAt", "expiresAt", "downloadCount", "transferredTo") VALUES 
  ('test-file-1', 'registry/test/fichier1.json', '{"test": 1}', 'hash111', 100, 'v-test-1', NOW(), NOW() + INTERVAL '7 days', 0, ARRAY[]::TEXT[]),
  ('test-file-2', 'registry/test/fichier2.json', '{"test": 2}', 'hash222', 200, 'v-test-1', NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 2, ARRAY['user-1', 'user-2']),
  ('test-file-3', 'registry/test/expired.json', '{"test": 3}', 'hash333', 300, 'v-test-1', NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', 5, ARRAY['user-3']);

INSERT INTO "UserSyncState" (id, "userId", "lastSyncAt", "lastSyncVersion", "pendingCount", "syncedFileIds") VALUES
  ('test-sync-1', 'user-1', NOW() - INTERVAL '2 hours', 'v-test-1', 1, ARRAY['test-file-1']),
  ('test-sync-2', 'user-2', NOW() - INTERVAL '5 days', 'v-test-0', 2, ARRAY[]::TEXT[]);
