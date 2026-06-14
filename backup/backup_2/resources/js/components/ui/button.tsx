import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-[color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // "Nyomós" 3D hatás: alsó él a shade színből, lenyomásra besüllyed
        default:
          "bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--color-primary-shade)] hover:brightness-105 active:translate-y-0.75 active:shadow-[0_1px_0_0_var(--color-primary-shade)]",
        destructive:
          "bg-destructive text-white shadow-[0_4px_0_0_oklch(0.5_0.18_25)] hover:brightness-105 active:translate-y-0.75 active:shadow-[0_1px_0_0_oklch(0.5_0.18_25)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-2 border-border bg-background shadow-[0_3px_0_0_var(--color-secondary-shade)] hover:bg-accent hover:text-accent-foreground active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-secondary-shade)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_3px_0_0_var(--color-secondary-shade)] hover:brightness-97 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-secondary-shade)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
