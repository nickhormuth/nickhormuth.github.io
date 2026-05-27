// ntfy.sh phone push. Free, no account — just pick an unguessable topic name and subscribe on
// your phone via the ntfy app.

export async function pushNtfy(opts: {
  topic: string;
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  clickUrl?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    Title: opts.title,
  };
  if (opts.priority) headers.Priority = String(opts.priority);
  if (opts.clickUrl) headers.Click = opts.clickUrl;
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(opts.topic)}`, {
    method: "POST",
    headers,
    body: opts.message,
  });
  if (!res.ok) {
    throw new Error(`ntfy push failed: ${res.status} ${await res.text()}`);
  }
}
