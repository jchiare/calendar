"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewClientForm() {
  const router = useRouter(); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const response = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const result = await response.json(); setSaving(false); if (!response.ok) { setError(result.error ?? "Could not create client"); return; } router.push(`/clients/${result.client.id}`); router.refresh(); }
  return <form onSubmit={submit} className="form-grid"><label>First name<input name="firstName" required placeholder="Mia"/></label><label>Last name<input name="lastName" required placeholder="Robinson"/></label><label>Date of birth<input type="date" name="dob" required/></label><label>Parent or guardian name<input name="parentName" required placeholder="Jordan Robinson"/></label><label>Parent email<input type="email" name="parentEmail" required placeholder="jordan@example.com"/></label><label>Assigned therapist<select name="therapistUserId"><option value="demo-therapist">Alex Johnson</option><option value="samira-patel">Samira Patel</option></select></label><label className="full">Notes <span>optional</span><textarea name="intakeNotes" placeholder="Anything the care team should know before intake."/></label>{error && <p className="form-error full">{error}</p>}<div className="form-actions full"><Link href="/clients">Cancel</Link><button className="primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create client & invite parent"}</button></div></form>;
}
