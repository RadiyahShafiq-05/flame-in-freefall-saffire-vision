"use client";
export default function ImageViewer({ src, alt, full }: { src: string; alt: string; full?: boolean }) {
  return (<a href={src} target="_blank" rel="noreferrer" title="Open full resolution">
    <img src={src} alt={alt} className={full ? "w-full" : "w-full rounded border border-edge object-contain max-h-96 bg-black"} /></a>);
}
