import { Fragment } from "react";

// Long NASA filenames have no spaces; allow line breaks only after "_" and "-" so they wrap at
// segment boundaries instead of mid-word.
export default function FileName({ name, className = "" }: { name: string; className?: string }) {
  const parts = name.split(/(?<=[_-])/);
  return (
    <span className={`font-mono ${className}`} title={name}>
      {parts.map((p, i) => <Fragment key={i}>{p}{i < parts.length - 1 && <wbr />}</Fragment>)}
    </span>
  );
}
