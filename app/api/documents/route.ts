import { put } from "@vercel/blob";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { ask } from "@/lib/ai";
import { requireRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { requireClientAccess } from "@/lib/resource-access";

export const maxDuration = 60;

export async function POST(request: Request) {
  let documentId: string | undefined;
  try {
    const actor = await requireRole(["admin", "therapist", "parent"]); const form = await request.formData();
    const file = z.instanceof(File).parse(form.get("file")); const clientId = z.string().uuid().parse(form.get("clientId")); const clientName = z.string().optional().parse(form.get("clientName") || undefined); await requireClientAccess(actor, clientId);
    if (file.type !== "application/pdf" || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Upload a PDF smaller than 20 MB." }, { status: 400 });
    const blob = await put(`clinics/${actor.clinicId}/clients/${clientId}/${crypto.randomUUID()}.pdf`, file, { access: "private" });
    const [document] = await db.insert(documents).values({ clinicId: actor.clinicId, clientId, blobUrl: blob.url, kind: "iep" }).returning();
    documentId = document.id;
    const bytes = new Uint8Array(await file.arrayBuffer()); const pdf = await getDocumentProxy(bytes); const extracted = await extractText(pdf, { mergePages: true }); let input: unknown = { text: extracted.text };
    if (extracted.text.trim().length < 250) {
      const pages = []; for (let page = 1; page <= Math.min(pdf.numPages, 12); page++) pages.push(Buffer.from(await renderPageAsImage(pdf, page, { scale: 1.4 })).toString("base64"));
      input = { scannedPageImagesBase64: pages };
    }
    const result = await ask("extract_iep", input, { clinicId: actor.clinicId, clientName });
    await db.update(documents).set({ extracted: result, status: "done", updatedAt: new Date() }).where((await import("drizzle-orm")).eq(documents.id, document.id));
    return NextResponse.json({ documentId: document.id, ...result });
  } catch (error) {
    if (documentId) await db.update(documents).set({ status: "failed", updatedAt: new Date() }).where((await import("drizzle-orm")).eq(documents.id, documentId)).catch(() => undefined);
    return apiError(error);
  }
}
