import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import { Resend } from "resend";
import { db } from "@/db";
import { emails } from "@/db/schema";

type EmailInput = { clinicId: string | null; to: string; kind: "parent_invite" | "appointment_booked" | "appointment_cancelled" | "appointment_reminder" | "session_summary_ready"; subject: string; message: string; actionUrl: string; actionLabel: string };

function ClinicEmail({ subject, message, actionUrl, actionLabel }: Pick<EmailInput, "subject" | "message" | "actionUrl" | "actionLabel">) {
  return <Html><Head/><Preview>{subject}</Preview><Body style={{ backgroundColor: "#f7f6f1", fontFamily: "Arial, sans-serif", padding: "32px 12px" }}><Container style={{ backgroundColor: "#fff", border: "1px solid #e4e7e3", borderRadius: 12, margin: "0 auto", maxWidth: 520, padding: 32 }}><Text style={{ color: "#ee754d", fontSize: 24, fontWeight: 700, margin: 0 }}>sayso</Text><Heading style={{ color: "#25312d", fontSize: 26, fontWeight: 500 }}>{subject}</Heading><Text style={{ color: "#66706b", fontSize: 15, lineHeight: 1.6 }}>{message}</Text><Section style={{ marginTop: 24 }}><Button href={actionUrl} style={{ backgroundColor: "#335f50", borderRadius: 7, color: "#fff", fontSize: 14, padding: "12px 18px" }}>{actionLabel}</Button></Section><Text style={{ color: "#9aa19d", fontSize: 11, lineHeight: 1.5, marginTop: 28 }}>For privacy, clinical information is never included in email. Sign in to Sayso to view details.</Text></Container></Body></Html>;
}

export async function sendClinicEmail(input: EmailInput) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email preview] ${input.kind} to ${input.to}`);
    return { id: "preview" };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({ from: process.env.EMAIL_FROM ?? "Sayso <hello@updates.sayso.care>", to: input.to, subject: input.subject, react: <ClinicEmail {...input}/> });
  if (error) throw new Error(error.message);
  if (input.clinicId) await db.insert(emails).values({ clinicId: input.clinicId, to: input.to, kind: input.kind, resendId: data?.id });
  return data;
}
