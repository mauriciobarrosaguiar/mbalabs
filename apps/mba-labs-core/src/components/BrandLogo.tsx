import { Boxes } from "lucide-react";

type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: {
    wrapper: "gap-2.5",
    mark: "h-10 w-10 rounded-[13px]",
    icon: 22,
    text: "text-[19px]"
  },
  md: {
    wrapper: "gap-3",
    mark: "h-12 w-12 rounded-[15px]",
    icon: 27,
    text: "text-[24px]"
  },
  lg: {
    wrapper: "gap-4",
    mark: "h-16 w-16 rounded-[20px]",
    icon: 34,
    text: "text-[34px]"
  }
} as const;

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  const selected = sizes[size];

  return (
    <span className={`inline-flex items-center ${selected.wrapper} ${className}`.trim()}>
      <span
        className={`inline-flex shrink-0 items-center justify-center border border-violet-400/35 bg-[linear-gradient(145deg,rgba(109,72,255,0.34),rgba(48,30,109,0.52))] text-violet-300 shadow-[0_0_28px_rgba(124,92,255,0.18)] ${selected.mark}`}
        aria-hidden="true"
      >
        <Boxes size={selected.icon} strokeWidth={2.35} />
      </span>
      <span className={`whitespace-nowrap font-black tracking-[-0.045em] ${selected.text}`}>
        <span className="text-white">MBA </span>
        <span className="bg-gradient-to-r from-[#815dff] via-[#3d8df6] to-[#22d3b6] bg-clip-text text-transparent">
          Labs
        </span>
      </span>
    </span>
  );
}
