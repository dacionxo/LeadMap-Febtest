import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/app/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent text-white bg-blue-600',
        primary: 'border-transparent text-white bg-blue-600',
        secondary: 'border-transparent bg-gray-600 text-white',
        success: 'border-transparent bg-green-600 text-white',
        warning: 'border-transparent bg-yellow-600 text-white',
        info: 'border-transparent bg-blue-500 text-white',
        error: 'border-transparent bg-red-600 text-white',
        outline: 'border-blue-600 text-blue-600',
        outlineSecondary: 'border-gray-600 text-gray-600',
        outlineSuccess: 'border-green-600 text-green-600',
        outlineWarning: 'border-yellow-600 text-yellow-600',
        outlineError: 'border-red-600 text-red-600',
        outlineInfo: 'border-blue-500 text-blue-500',
        lightPrimary: 'bg-blue-100 text-blue-700 border-0',
        lightSecondary: 'bg-gray-100 text-gray-700 border-0',
        lightSuccess: 'bg-green-100 text-green-700 border-0',
        lightError: 'bg-red-100 text-red-700 border-0',
        lightInfo: 'bg-blue-100 text-blue-700 border-0',
        lightWarning: 'bg-yellow-100 text-yellow-700 border-0',
        destructive: 'border-transparent bg-red-600 text-white',
        gray: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-0',
        lightgray: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0',
        white: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-0",
        muted: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
