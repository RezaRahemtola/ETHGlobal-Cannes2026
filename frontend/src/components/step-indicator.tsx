import { cn } from "@/lib/utils";

const stepColors = [
  { bg: "#6EE7B7" },
  { bg: "#3889FF" },
  { bg: "#8B5CF6" },
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
              "h-1 w-7 rounded-full transition-all duration-300",
              !isActive && !isDone && "bg-white/[0.08]",
            )}
            style={
              isActive
                ? {
                    backgroundColor: stepColors[i].bg,
                    boxShadow: `0 0 8px ${stepColors[i].bg}40`,
                  }
                : isDone
                  ? { backgroundColor: stepColors[i].bg, opacity: 0.3 }
                  : undefined
            }
          />
        );
      })}
    </div>
  );
}
