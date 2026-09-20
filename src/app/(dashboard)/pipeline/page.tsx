import { DeployPipeline } from '@/components/pipeline/DeployPipeline';
import { GenerateContextButton } from '@/components/pipeline/GenerateContextButton';

export default function PipelinePage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <DeployPipeline />

      <div className="border-t pt-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">📊 Suivi du projet</h3>
            <p className="text-sm text-muted-foreground">
              Génère le fichier <code className="font-mono">.dev/context.json</code> avec l&apos;état complet du projet.
            </p>
          </div>
          <GenerateContextButton />
        </div>
      </div>
    </div>
  );
}
