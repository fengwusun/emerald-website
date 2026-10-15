"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductPreview({ src, alt, title }: { src: string; alt: string; title?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="secondary btn-small"
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide preview" : "Preview"}
      </button>
      {open ? (
        <a className="product-preview" href={src} target="_blank" rel="noreferrer">
          <Image src={src} alt={alt} width={1100} height={700} unoptimized style={{ width: "100%", height: "auto" }} />
        </a>
      ) : null}
    </>
  );
}
