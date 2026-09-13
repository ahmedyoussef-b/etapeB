"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, User } from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  status: "present" | "absent" | "on-break";
}

interface Team {
  id: number;
  name: string;
  color: string;
  members: TeamMember[];
}

const teams: Team[] = [
  {
    id: 1,
    name: "Équipe A",
    color: "border-blue-500",
    members: [
      { id: 1, name: "Dupont Jean", role: "Chef de quart", status: "present" },
      { id: 2, name: "Martin Marie", role: "Rondier", status: "present" },
      { id: 3, name: "Leroy Paul", role: "Rondier", status: "absent" },
      { id: 4, name: "Moreau Emma", role: "Chef de bloc", status: "present" },
    ],
  },
  {
    id: 2,
    name: "Équipe B",
    color: "border-green-500",
    members: [
      { id: 5, name: "Bernard Luc", role: "Chef de quart", status: "present" },
      { id: 6, name: "Petit Anna", role: "Rondier", status: "on-break" },
      { id: 7, name: "Robert Francois", role: "Rondier", status: "present" },
    ],
  },
];

const statusColors = {
  present: "bg-emerald-500",
  absent: "bg-rose-500",
  "on-break": "bg-amber-500",
};

export function TeamOverview() {
  return (
    <Card className="rounded-2xl border-border/60 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Vue d&apos;équipe</h2>
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <div key={team.id} className={`border-l-4 ${team.color} rounded-lg p-3 bg-muted/30`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{team.name}</h3>
              <Badge variant="secondary" className="rounded-lg text-xs">
                {team.members.length} membres
              </Badge>
            </div>
            <div className="space-y-2">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                      <User className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${statusColors[member.status]}`}
                    title={member.status}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
