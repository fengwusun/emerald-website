import { loadCoiMembers } from "@/lib/data";
import { TeamMailIcon, MailAllButton, TeamPasswordDialog } from "@/components/team-mail-button";

export default function TeamPage() {
  const members = loadCoiMembers();
  const allNames = members.filter((m) => m.email).map((m) => m.name);

  return (
    <div className="grid">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Team</h1>
        <MailAllButton names={allNames} />
      </div>
      <TeamPasswordDialog />
      <p className="muted">
        Co-I roster and collaborating members from the JADES / CONGRESS survey
        community.
      </p>
      <section className="grid grid-2">
        {members.map((member) => (
          <article className="card" key={member.name}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <h2>{member.name}</h2>
              {member.email && <TeamMailIcon name={member.name} />}
            </div>
            {member.role !== "Co-Investigator" ? (
              <p>
                <strong>{member.role}</strong>
              </p>
            ) : null}
            <p>{member.affiliation}</p>
            {member.orcid ? <p className="muted">ORCID: {member.orcid}</p> : null}
            {member.profile_url ? (
              <p>
                <a href={member.profile_url} target="_blank" rel="noreferrer">
                  Profile
                </a>
              </p>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
