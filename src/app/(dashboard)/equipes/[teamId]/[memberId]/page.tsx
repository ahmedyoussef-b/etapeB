import { teams } from "@/data/teams";
import MembreDetailClient from "./MembreDetailClient";

export function generateStaticParams() {
  const params: { teamId: string; memberId: string }[] = [];
  for (const team of teams) {
    for (const member of team.members_list ?? []) {
      params.push({
        teamId: String(team.id),
        memberId: String(member.id),
      });
    }
  }
  return params;
}

interface PageProps {
  params: { teamId: string; memberId: string };
}

export default function MembreDetailPage({ params }: PageProps) {
  return <MembreDetailClient teamId={params.teamId} memberId={params.memberId} />;
}
