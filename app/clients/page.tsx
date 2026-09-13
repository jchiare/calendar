import Link from "next/link";
import { AppShell, Avatar, StatusBadge } from "@/components/app-shell";
import { demoClients } from "@/lib/demo";

export default function ClientsPage() {
  return (
    <AppShell
      title="Clients"
      eyebrow="CASELOAD"
      action={
        <Link className="primary link-button" href="/clients/new">
          ＋ Add a child
        </Link>
      }
    >
      <div className="toolbar">
        <label>
          ⌕ <input placeholder="Search by child or parent" />
        </label>
        <button>All therapists⌄</button>
        <button>Active clients⌄</button>
      </div>
      <section className="data-card">
        <div className="table-row table-head">
          <span>CLIENT</span>
          <span>ASSIGNED THERAPIST</span>
          <span>NEXT SESSION</span>
          <span>ACTIVE GOALS</span>
          <span>STATUS</span>
        </div>
        {demoClients.map((client) => (
          <Link href={`/clients/${client.id}`} className="table-row" key={client.id}>
            <span className="client-cell">
              <Avatar initials={client.initials} tone={client.tone} />
              <span>
                <strong>{client.name}</strong>
                <small>
                  Age {client.age} · {client.parent}
                </small>
              </span>
            </span>
            <span>{client.therapist}</span>
            <span>{client.next}</span>
            <span>{client.goals}</span>
            <span>
              <StatusBadge>Active</StatusBadge>
            </span>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
