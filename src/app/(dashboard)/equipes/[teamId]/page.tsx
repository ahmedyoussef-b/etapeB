import { teams } from "@/data/teams";
import EquipeDetailClient from "./EquipeDetailClient";

export function generateStaticParams() {
  return teams.map((t) => ({ teamId: String(t.id) }));
}

interface PageProps {
  params: { teamId: string };
}

export default function EquipeDetailPage({ params }: PageProps) {
  return <EquipeDetailClient teamId={params.teamId} />;
}
