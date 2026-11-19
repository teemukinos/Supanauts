import { cva, VariantProps } from 'class-variance-authority';
import * as React from 'react';

const SIZE_VARIANTS = {
  tiny: 'h-7 text-xs',
  small: 'h-9 text-sm',
  medium: 'h-10 text-sm',
  large: 'h-11 text-base',
};
const SIZE_VARIANTS_DEFAULT = 'small' as const;
import { cn } from './utils';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, VariantProps<typeof InputVariants> {}

export const InputVariants = cva(
  cn(
    'flex h-10 w-full rounded-md border border-control hover:border-control-hover read-only:border-button bg-field px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground-muted read-only:text-foreground-light',
    'focus:border-control-hover focus-ring disabled:cursor-not-allowed disabled:text-foreground-muted transition-colors duration-200',
    'aria-[invalid=true]:bg-destructive-200 aria-[invalid=true]:border-destructive-400 aria-[invalid=true]:hover:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus-visible:border-destructive',
  ),
  {
    variants: {
      size: {
        ...SIZE_VARIANTS,
      },
    },
    defaultVariants: {
      size: SIZE_VARIANTS_DEFAULT,
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = 'small', ...props }, ref) => {
    return <input type={type} ref={ref} {...props} className={cn(InputVariants({ size }), className)} />;
  },
);

Input.displayName = 'Input';

export { Input };
