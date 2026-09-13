"use client";
import { useState } from "react";
import { demoGoals } from "@/lib/demo";

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => {
      lang: string;
      continuous: boolean;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onend: () => void;
      start(): void;
      stop(): void;
    };
  }
}

export function SessionEditor({
  appointmentId,
  clientName,
}: {
  appointmentId: string;
  clientName: string;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [parentSummary, setParentSummary] = useState("");
  const [homePractice, setHomePractice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  function startDictation() {
    const SpeechRecognition = window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage("Dictation is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.onresult = (speechEvent) =>
      setNotes((value) =>
        `${value} ${speechEvent.results[speechEvent.results.length - 1][0].transcript}`.trim(),
      );
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  }
  async function generateDraft() {
    setIsGenerating(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/ai/session_summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName,
          input: {
            goals: demoGoals.map((goal) => ({
              id: goal.id,
              text: goal.text,
              rating: ratings[goal.id],
            })),
            notes,
            lastThreeSummaries: [],
          },
        }),
      });
      const draft = await response.json();
      if (!response.ok) {
        throw new Error(draft.error ?? "Generation failed");
      }
      setClinicalNote(draft.clinicalNote);
      setParentSummary(draft.parentSummary);
      setHomePractice(draft.homePractice);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }
  async function saveSessionSummary() {
    setIsSaving(true);
    setErrorMessage("");
    const response = await fetch(`/api/appointments/${appointmentId}/session`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        noteText: clinicalNote,
        parentSummaryText: homePractice
          ? `${parentSummary}\n\nHome practice: ${homePractice}`
          : parentSummary,
        progress: demoGoals
          .filter((goal) => ratings[goal.id])
          .map((goal) => ({
            goalId: goal.id,
            rating: ratings[goal.id],
            comment: comments[goal.id],
          })),
      }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) setErrorMessage(result.error ?? "Could not save session");
    else window.location.assign("/dashboard");
  }
  return (
    <div className="session-layout">
      <div>
        <section className="data-card section-card">
          <div className="section-title">
            <div>
              <h2>Goal check-in</h2>
              <p>Rate today&apos;s performance. 1 = maximum support, 5 = independent.</p>
            </div>
          </div>
          {demoGoals.map((goal) => (
            <div className="rating-row" key={goal.id}>
              <div>
                <span>{goal.domain}</span>
                <p>{goal.text}</p>
              </div>
              <div className="rating-buttons">
                {[1, 2, 3, 4, 5].map((ratingValue) => (
                  <button
                    className={ratings[goal.id] === ratingValue ? "selected" : ""}
                    onClick={() => setRatings({ ...ratings, [goal.id]: ratingValue })}
                    key={ratingValue}
                  >
                    {ratingValue}
                  </button>
                ))}
              </div>
              <input
                aria-label={`Comment for ${goal.domain}`}
                value={comments[goal.id] ?? ""}
                onChange={(event) =>
                  setComments({ ...comments, [goal.id]: event.target.value })
                }
                placeholder="Optional observation"
              />
            </div>
          ))}
        </section>
        <section className="data-card section-card notes-editor">
          <div className="section-title">
            <div>
              <h2>Session notes</h2>
              <p>Capture observations in your own words.</p>
            </div>
            <button
              className={isListening ? "dictating" : "soft-button"}
              onClick={startDictation}
            >
              ◉ {isListening ? "Listening…" : "Dictate"}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What did you work on? What cues helped? How did the client respond?"
          />
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          <button className="ai-button" onClick={generateDraft} disabled={isGenerating}>
            ✦ {isGenerating ? "Drafting summaries…" : "Generate draft with AI"}
          </button>
        </section>
      </div>
      <aside>
        <section className="data-card draft-card">
          <span className="draft-label">AI DRAFT · REVIEW REQUIRED</span>
          <h3>Clinical note</h3>
          <textarea
            value={clinicalNote}
            onChange={(event) => setClinicalNote(event.target.value)}
            placeholder="Generate a draft, then review and edit it here."
          />
          <h3>Parent-friendly summary</h3>
          <textarea
            value={parentSummary}
            onChange={(event) => setParentSummary(event.target.value)}
            placeholder="The family update will appear here."
          />
          <h3>Home practice</h3>
          <textarea
            className="short"
            value={homePractice}
            onChange={(event) => setHomePractice(event.target.value)}
            placeholder="One suggested activity."
          />
          <p className="safety-note">Nothing is saved or shared until you review it.</p>
          <button
            className="primary wide"
            disabled={!clinicalNote || !parentSummary || isSaving}
            onClick={saveSessionSummary}
          >
            {isSaving ? "Saving…" : "Save & send summary"}
          </button>
        </section>
      </aside>
    </div>
  );
}
