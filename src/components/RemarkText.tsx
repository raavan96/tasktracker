export default function RemarkText({ text }: { text: string }) {
  // Render text nodes, never HTML. Only explicit HTTP(S) URLs become links.
  return <>{text.split(/(https?:\/\/[^\s<>]+)/gi).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const url = part.replace(/[.,;!?]+$/, '');
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return part; } catch { return part; }
    return <span key={index}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 break-all">{url}</a>{part.slice(url.length)}</span>;
  })}</>;
}
