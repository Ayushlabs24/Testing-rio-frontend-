import type { CSSProperties, ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { VariantProps } from "class-variance-authority";

interface LoadingButtonProps
  extends
    Omit<React.ComponentProps<"button">, "className" | "style">,
    VariantProps<typeof buttonVariants> {
  text: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Trailing icon shown only while idle (e.g. `<ArrowRight />`) — hidden
   * whenever `isLoading`, so it never competes with the spinner. */
  endIcon?: ReactNode;
  /** Leading icon shown only while idle (e.g. `<Check />`) — occupies the
   * same inline-start slot the spinner takes over once `isLoading`. */
  startIcon?: ReactNode;
}

/**
 * Generic action button with a built-in loading state — swaps in a
 * spinner (shadcn's `Spinner`, positioned via the Button's own
 * `data-icon=inline-start` spacing hook) and disables the button while
 * `isLoading` is true, on top of any explicit `disabled`.
 */
export function LoadingButton({
  text,
  isLoading = false,
  disabled = false,
  className,
  style,
  variant,
  size,
  endIcon,
  startIcon,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      style={style}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Spinner data-icon="inline-start" />
      ) : startIcon ? (
        <span data-icon="inline-start" className="inline-flex">
          {startIcon}
        </span>
      ) : null}
      {text}
      {!isLoading && endIcon ? (
        <span data-icon="inline-end" className="inline-flex">
          {endIcon}
        </span>
      ) : null}
    </Button>
  );
}
