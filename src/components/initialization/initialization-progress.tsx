type InitializationProgressProps = {
  progress: number;
  label?: string;
};

export function InitializationProgress({ progress, label = 'Initialisation de la base locale...' }: InitializationProgressProps) {
  return (
    <div className="w-full max-w-md space-y-3 text-left">
      <div className="flex items-center justify-between text-sm text-slate-200">
        <span>{label}</span>
        <span>{Math.max(0, Math.min(100, progress))}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
