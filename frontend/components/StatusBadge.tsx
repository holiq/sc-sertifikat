import { CertStatus } from "@/lib/contract";

interface StatusBadgeProps {
  status: CertStatus;
}

const config: Record<CertStatus, { label: string; className: string }> = {
  [CertStatus.Active]: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
  [CertStatus.Revoked]: {
    label: "Revoked",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  [CertStatus.Updated]: {
    label: "Updated",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = config[status] ?? config[CertStatus.Active];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
