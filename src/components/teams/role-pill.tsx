import type { TeamRole } from "@/lib/auth/team-access";
import { Pill } from "@/components/ui/pill";

const ROLE_LABELS: Record<TeamRole, string> = {
  LEAD: "Lead",
  MEMBER: "Member",
  INSTRUCTOR: "Instructor",
};

export function RolePill({ role }: { role: TeamRole }) {
  return <Pill>{ROLE_LABELS[role]}</Pill>;
}
