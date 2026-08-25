/**
 * Real <table> with <th scope>. Wide content scrolls inside its own
 * container — the page never scrolls horizontally.
 */
export function Table({
  headers,
  children,
  caption,
}: {
  headers: string[];
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card">
      <table className="w-full border-collapse text-body-s">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap border-b border-hairline px-tight py-tight text-left text-caption font-semibold uppercase tracking-[0.04em] text-ink-2"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
