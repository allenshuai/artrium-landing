import Image from "next/image";
import { avatarFor } from "./people";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export default function Avatar({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const src = avatarFor(name);
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-[#3F3A36] align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={size * 2}
          height={size * 2}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span
          className="font-semibold leading-none text-[#FFFAF6]"
          style={{ fontSize: Math.max(8, Math.round(size * 0.45)) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
