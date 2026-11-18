/** Renders the current toast message (if any) with the caller's positioning/look. */
export function Toast({ message, className }: { message: string | null; className: string }) {
  if (!message) return null;
  return (
    <div role="status" className={className}>
      {message}
    </div>
  );
}
