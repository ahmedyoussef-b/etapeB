import { ProcedureGuidePageClient } from "./ProcedureGuidePageClient";

interface PageProps {
  params: { id: string };
}

export async function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function ProcedureGuidePage({ params }: PageProps) {
  return <ProcedureGuidePageClient id={params.id} />;
}
