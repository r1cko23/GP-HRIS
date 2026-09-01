import * as React from "react";

import { cn, toTitleCaseWords } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoCapitalizeWords?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoCapitalizeWords = false, onChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nativeEvent = event.nativeEvent as Event & { isComposing?: boolean };
      if (nativeEvent.isComposing) {
        onChange?.(event);
        return;
      }

      if (autoCapitalizeWords) {
        event.target.value = toTitleCaseWords(event.target.value);
      }

      onChange?.(event);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };