import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  activeClassName?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, activeClassName, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "relative overflow-hidden group",
        "flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 min-w-[44px] min-h-[44px]",
        "rounded-lg",
        "bg-gradient-to-br from-secondary via-secondary to-secondary/80",
        "border border-border/50",
        "shadow-sm hover:shadow-md hover:shadow-primary/10",
        "transition-all duration-300 ease-out",
        "hover:scale-110 active:scale-95",
        "hover:border-primary/30",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active && (activeClassName || "ring-2 ring-primary/50 border-primary/30 bg-primary/5"),
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      {children}
    </button>
  )
)
IconButton.displayName = "IconButton"
