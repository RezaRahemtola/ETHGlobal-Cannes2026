import { cn } from "@/lib/utils";

const stepColors = [
  "bg-[var(--brand-mint)]",
  "bg-[var(--brand-blue)]",
  "bg-[var(--brand-purple)]",
];

const stepDoneColors = [
  "bg-[var(--brand-mint)]/30",
  "bg-[var(--brand-blue)]/30",
  "bg-[var(--brand-purple)]/30",
];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 3 }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        return (
          <div
            key={i}
            className={cn(
              "h-1 w-7 rounded-full transition-colors",
              isActive
                ? stepColors[i]
                : isDone
                  ? stepDoneColors[i]
                  : "bg-white/[0.08]",
            )}
          />
        );
      })}
    </div>
  );
}
