import { ScienceProjectsBoard } from "@/components/science-projects-board";
import { loadCoiMembers } from "@/lib/data";

export default function ScienceProjectsPage() {
  const members = loadCoiMembers().map((member) => ({
    name: member.name,
    email: member.email
  }));

  return <ScienceProjectsBoard members={members} />;
}
