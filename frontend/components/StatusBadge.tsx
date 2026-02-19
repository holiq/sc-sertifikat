import { CertStatus } from "@/lib/contract";

interface StatusBadgeProps {
  status: CertStatus;
}

const config: Record<CertStatus, { label: string; dotColor: string; className: string }> = {
  [CertStatus.Active]: {
    label: "Active",
    dotColor: "bg-emerald-500",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
  [CertStatus.Revoked]: {
    label: "Revoked",
    dotColor: "bg-red-500",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  [CertStatus.Updated]: {
    label: "Updated",
    dotColor: "bg-amber-500",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, dotColor, className } = config[status] ?? config[CertStatus.Active];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor} shrink-0`} />
      {label}
    </span>
  );
}
