import { AppShell } from "@/components/app-shell";
import { NewClientForm } from "@/components/new-client-form";

export default function NewClientPage() {
  return <AppShell title="Add a child" eyebrow="CLIENTS / NEW"><section className="form-card"><div className="form-intro"><h2>Child and guardian</h2><p>Six fields are enough to create the chart and invite the parent. Intake and documents can come next.</p></div><NewClientForm/></section></AppShell>;
}
