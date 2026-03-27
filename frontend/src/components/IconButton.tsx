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
        "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9",
        "rounded-lg",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/80",
        "transition-all duration-200 ease-out",
        "active:scale-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active && (activeClassName || "text-primary bg-primary/5"),
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
IconButton.displayName = "IconButton"
