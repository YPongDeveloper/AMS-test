export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round">
        <path d="M116 332 V212 Q116 76 256 76 Q396 76 396 212 V332 Q396 348 380 348 H132 Q116 348 116 332 Z" />
      </g>
      <g stroke="currentColor" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
        <rect x="142" y="126" width="102" height="78" rx="14" />
        <rect x="268" y="126" width="102" height="78" rx="14" />
        <circle cx="172" cy="262" r="17" />
        <circle cx="340" cy="262" r="17" />
        <path d="M116 314 H396" />
        <circle cx="160" cy="388" r="14" strokeWidth={16} />
        <circle cx="352" cy="388" r="14" strokeWidth={16} />
        <path d="M132 426 H380" />
        <path d="M168 446 H344" strokeWidth={14} />
        <circle cx="256" cy="390" r="9" strokeWidth={14} />
      </g>
    </svg>
  );
}
