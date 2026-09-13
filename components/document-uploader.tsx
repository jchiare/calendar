"use client";
import { useRef, useState } from "react";

type IepExtractionResult = {
  summary: string;
  goals: {
    domain: string;
    text: string;
    baseline?: string;
    criterion?: string;
  }[];
  services: string;
  accommodations: string[];
};
export function DocumentUploader({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processingStatus, setProcessingStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [extractionResult, setExtractionResult] = useState<IepExtractionResult>();
  const [selectedGoals, setSelectedGoals] = useState<Record<number, boolean>>({});
  const [errorMessage, setErrorMessage] = useState("");
  async function uploadDocument(file?: File) {
    if (!file) return;
    setProcessingStatus("uploading");
    const uploadFormData = new FormData();
    uploadFormData.set("file", file);
    uploadFormData.set("clientId", clientId);
    uploadFormData.set("clientName", clientName);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: uploadFormData,
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody.error);
      setExtractionResult(responseBody);
      setProcessingStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setProcessingStatus("error");
    }
  }
  async function saveSelectedGoals(event: React.FormEvent) {
    event.preventDefault();
    if (!extractionResult) return;
    setErrorMessage("");
    const response = await fetch(`/api/clients/${clientId}/goals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goals: extractionResult.goals.map((goal, index) => ({
          ...goal,
          keep: selectedGoals[index] ?? true,
        })),
      }),
    });
    const responseBody = await response.json();
    if (!response.ok) {
      setErrorMessage(responseBody.error ?? "Could not save goals");
      return;
    }
    setExtractionResult(undefined);
  }
  return (
    <section className="data-card upload-card">
      <div className="upload-icon">⇧</div>
      <h3>IEP or prior evaluation</h3>
      <p>Upload a PDF and Sayso will draft goals for your review.</p>
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="application/pdf"
        onChange={(event) => uploadDocument(event.target.files?.[0])}
      />
      <button
        className="soft-button wide-soft"
        disabled={processingStatus === "uploading"}
        onClick={() => fileInputRef.current?.click()}
      >
        {processingStatus === "uploading"
          ? "Extracting securely…"
          : processingStatus === "done"
            ? "Upload another PDF"
            : "Choose PDF"}
      </button>
      <small>PDF · up to 20 MB</small>
      {errorMessage && <p className="form-error">{errorMessage}</p>}
      {extractionResult && (
        <form onSubmit={saveSelectedGoals} className="extract-result">
          <strong>Draft ready — therapist review</strong>
          <p>{extractionResult.summary}</p>
          {extractionResult.goals.map((goal, index) => (
            <label className="extracted-goal" key={`${goal.domain}-${index}`}>
              <input
                type="checkbox"
                checked={selectedGoals[index] ?? true}
                onChange={(event) =>
                  setSelectedGoals({
                    ...selectedGoals,
                    [index]: event.target.checked,
                  })
                }
              />
              <span>
                <b>{goal.domain}</b>
                {goal.text}
              </span>
            </label>
          ))}
          <button className="soft-button wide-soft">Save kept goals</button>
        </form>
      )}
    </section>
  );
}
