"use client";
import { useParams } from "next/navigation";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  const en = useParams().locale === "en";
  return (
    <main className="error-screen">
      <h1>
        {en
          ? "Your space is temporarily unavailable."
          : "Votre espace est momentanément indisponible."}
      </h1>
      <p>
        {en
          ? "Your data has not been changed."
          : "Vos données n’ont pas été modifiées."}
      </p>
      <button className="primary" onClick={reset}>
        {en ? "Try again" : "Réessayer"}
      </button>
    </main>
  );
}
