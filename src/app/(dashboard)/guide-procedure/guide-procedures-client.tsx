"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import { GuideProceduresContent } from "./guide-procedures-content";

export function GuideProceduresClient() {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      <GuideProceduresContent />
    </Suspense>
  );
}

function GuideSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}
