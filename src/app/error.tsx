"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card max-w-lg">
      <h2 className="font-bold text-lg">Something went wrong</h2>
      <p className="text-slate-600 text-sm mt-2">The dashboard could not load this page. Your data was not changed.</p>
      <button className="btn-primary mt-4" type="button" onClick={() => reset()}>Try again</button>
      <a className="btn-secondary mt-4 ml-2 inline-block" href="/login">Go to login</a>
    </div>
  );
}
