import React from "react";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export interface AlertCardProps {
  variant: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<
  AlertCardProps["variant"],
  { bg: string; border: string; text: string; icon: React.ComponentType<any> }
> = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: Info,
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    icon: CheckCircle,
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    icon: AlertTriangle,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: XCircle,
  },
};

export const AlertCard: React.FC<AlertCardProps> = ({
  variant,
  title,
  message,
  dismissible = false,
  onDismiss,
}) => {
  const { bg, border, text, icon: Icon } = VARIANT_STYLES[variant];

  return (
    <div
      className={`relative overflow-hidden border rounded-lg p-4 flex items-start gap-3 shadow-sm transition-all animate-fade-in ${bg} ${border} ${text}`}
      role="alert"
    >
      <div className="pt-0.5">
        <Icon className={`w-6 h-6 ${text}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold leading-tight ${text}`}>{title}</h3>
        <div className="mt-1 text-sm">{message}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className={`absolute top-2 right-2 rounded hover:bg-black/5 focus:outline-none transition h-7 w-7 flex items-center justify-center ${text}`}
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// Tailwind animate utility (add this to global styles or tailwind config if needed)
// .animate-fade-in {
//   @apply transition-opacity duration-300 ease-out opacity-0;
//   animation: fade-in 0.3s forwards;
// }
// @keyframes fade-in {
//   to { opacity: 1; }
// }