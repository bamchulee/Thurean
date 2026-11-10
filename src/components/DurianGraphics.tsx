import React from "react";

// ตราประทับรับรองมาตรฐานการคัดเกรดพรีเมียม (Luxury Certification Seal)
export function LuxuryQualitySeal({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md" fill="none">
        {/* Outer Ring */}
        <circle cx="60" cy="60" r="56" stroke="#C5A059" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="52" stroke="#C5A059" strokeWidth="0.75" strokeDasharray="3 2" />
        
        {/* Background */}
        <circle cx="60" cy="60" r="48" fill="#0B1E13" />

        {/* Inner Gold Ring */}
        <circle cx="60" cy="60" r="44" stroke="#D4AF37" strokeWidth="1" />

        {/* Text Curvature simulation */}
        <text x="60" y="32" textAnchor="middle" fill="#E6C875" fontSize="6.5" fontWeight="600" letterSpacing="2.5">
          SIAM SELECT
        </text>

        <line x1="30" y1="40" x2="90" y2="40" stroke="#C5A059" strokeWidth="0.5" />

        <text x="60" y="55" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="800" letterSpacing="1">
          GRADE A+
        </text>

        <text x="60" y="68" textAnchor="middle" fill="#D4AF37" fontSize="8" fontWeight="600" letterSpacing="0.5">
          EXPORT QUALITY
        </text>

        <line x1="30" y1="75" x2="90" y2="75" stroke="#C5A059" strokeWidth="0.5" />

        <text x="60" y="86" textAnchor="middle" fill="#9CA3AF" fontSize="5.5" fontWeight="500" letterSpacing="1">
          100% REPLACEMENT
        </text>
        
        <circle cx="60" cy="94" r="1.5" fill="#D4AF37" />
      </svg>
    </div>
  );
}

// ตราสัญลักษณ์ Cold Chain 4°C
export function ColdChainBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#0d2818]/90 border border-[#c5a059]/40 text-[#f5eedc]">
      <svg className="w-3.5 h-3.5 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span className="text-[11px] font-semibold tracking-wider uppercase">Cold Chain 4°C Controlled</span>
    </div>
  );
}

// ตราสัญลักษณ์รับประกันคุณภาพ (Claim Guarantee Shield)
export function GuaranteeShield({ className = "w-5 h-5 text-[#c5a059]" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}
