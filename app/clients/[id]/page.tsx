import Link from "next/link";
import { AppShell, Avatar, StatusBadge } from "@/components/app-shell";
import { demoClients, demoGoals } from "@/lib/demo";
import { DocumentUploader } from "@/components/document-uploader";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = demoClients.find((item) => item.id === id) ?? demoClients[0];
  return (
    <AppShell
      title={client.name}
      eyebrow="CLIENT PROFILE"
      action={
        <Link className="primary link-button" href={`/sessions/${id}`}>
          Start session
        </Link>
      }
    >
      <div className="profile-banner">
        <Avatar initials={client.initials} tone={client.tone} />
        <div>
          <h2>{client.name}</h2>
          <p>
            Age {client.age} · Parent: {client.parent} · {client.email}
          </p>
        </div>
        <StatusBadge>Active</StatusBadge>
      </div>
      <div className="detail-grid">
        <div>
          <section className="data-card section-card">
            <div className="section-title">
              <div>
                <h2>Active goals</h2>
                <p>Reviewed and approved by the therapist</p>
              </div>
              <button className="soft-button">Plan next session ✦</button>
            </div>
            {demoGoals.map((goal) => (
              <div className="goal-row" key={goal.id}>
                <span className="goal-check">✓</span>
                <div>
                  <StatusBadge tone="purple">{goal.domain}</StatusBadge>
                  <p>{goal.text}</p>
                  {goal.streak && (
                    <small className="advance">
                      ✦ Rated 5/5 for three sessions — consider advancing
                    </small>
                  )}
                </div>
                <button>•••</button>
              </div>
            ))}
          </section>
          <section className="data-card section-card">
            <div className="section-title">
              <div>
                <h2>Recent summaries</h2>
                <p>Therapist-approved updates shared with the family</p>
              </div>
            </div>
            <div className="summary-row">
              <b>SEP 8</b>
              <div>
                <strong>Great engagement with /r/ practice</strong>
                <p>
                  Mia responded well to visual placement cues and practiced ten target
                  words.
                </p>
              </div>
            </div>
            <div className="summary-row">
              <b>SEP 3</b>
              <div>
                <strong>Building confidence in conversation</strong>
                <p>Worked on topic maintenance through a favorite-things activity.</p>
              </div>
            </div>
          </section>
        </div>
        <aside>
          <DocumentUploader clientId={client.id} clientName={client.name} />
          <section className="data-card mini-card">
            <h3>Care details</h3>
            <dl>
              <dt>Therapist</dt>
              <dd>{client.therapist}</dd>
              <dt>Parent</dt>
              <dd>{client.parent}</dd>
              <dt>Intake</dt>
              <dd>
                <StatusBadge>Complete</StatusBadge>
              </dd>
              <dt>Consent</dt>
              <dd>
                <StatusBadge>Received</StatusBadge>
              </dd>
            </dl>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
