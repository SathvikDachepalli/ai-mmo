"use client";

import Image from "next/image";
import type { Emotion } from "../../lib/store";

/** AI companion's sprite portrait, one PNG per expression, sliced from the
 * 16-emotion reference sheet into /public/ai-faces/{emotion}.png. */
export function AiFace({ emotion, size = 40, className = "" }: { emotion: Emotion; size?: number; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] border border-[var(--color-border)] ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`AI is feeling ${emotion}`}
      title={emotion}
    >
      <Image
        src={`/ai-faces/${emotion}.png`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="w-full h-full object-cover"
      />
    </span>
  );
}
