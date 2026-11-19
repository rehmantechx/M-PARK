"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card max-w-lg">
      <h2 className="font-bold text-lg">Something went wrong</h2>
      <p className="text-slate-600 text-sm mt-2">This page could not load. No data was changed.</p>
      <button className="btn-primary mt-4" type="button" onClick={() => reset()}>Try again</button>
    </div>
  );
}
