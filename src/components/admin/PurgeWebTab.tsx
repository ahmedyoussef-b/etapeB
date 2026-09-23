import { PurgeWebButton } from '@/components/admin/PurgeWebButton';

export function PurgeWebTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-background p-6">
        <h2 className="text-lg font-semibold mb-2">Purge des fichiers uploadés (BDD Web)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Supprime uniquement les fichiers uploadés dans la BDD Web (table <code>documents</code>).
          Cette action vide l&apos;assiette de transition sans toucher aux tables métier.
        </p>
        <PurgeWebButton />
      </div>
    </div>
  );
}
