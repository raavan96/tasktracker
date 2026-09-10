export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-4 py-4">
    <p className="text-sm text-gray-500">Loading workspace…</p>
    <div aria-hidden="true" className="grid gap-4 md:grid-cols-3 motion-safe:animate-pulse">
      {[0, 1, 2].map((item) => <div key={item} className="h-40 rounded-xl border border-gray-200 bg-surface" />)}
    </div>
  </div>;
}
