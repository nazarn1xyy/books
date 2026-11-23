import type { ChangeEvent, RefObject } from 'react';

interface BookFileInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onChange(event: ChangeEvent<HTMLInputElement>): void;
}

/** Hidden file picker behind the header's "add book" button. */
export function BookFileInput({ inputRef, onChange }: BookFileInputProps) {
  return (
    <input
      type="file"
      ref={inputRef}
      onChange={onChange}
      accept=".fb2,.zip,.fb2.zip,.pdf"
      className="hidden"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
