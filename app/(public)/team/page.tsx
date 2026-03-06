import { loadCoiMembers } from "@/lib/data";

export default function TeamPage() {
  const members = loadCoiMembers();

  return (
    <div className="grid">
      <h1>Team</h1>
      <p className="muted">
        Co-I roster and collaborating members from the JADES / CONGRESS survey
        community.
      </p>
      <section className="grid grid-2">
        {members.map((member) => (
          <article className="card" key={member.name}>
            <h2>{member.name}</h2>
            <p>
              <strong>{member.role}</strong>
            </p>
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
