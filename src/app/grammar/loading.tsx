export default function Loading() {
  return (
    <main className="shell py-10 sm:py-14 animate-pulse">
      <div className="h-4 w-40 rounded bg-ink/8 mb-4" />
      <div className="h-10 w-72 rounded bg-ink/8 mb-8" />
      <div className="h-24 rounded-2xl bg-ink/5 mb-10" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-ink/5" />
        ))}
      </div>
    </main>
  );
}
