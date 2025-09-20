import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const SIZE_MAP = {
  narrow: "max-w-xl",
  comfortable: "max-w-[52rem]",
  wide: "max-w-5xl",
  full: "max-w-none",
} as const

const PADDING_MAP = {
  none: "px-0",
  tight: "px-3 sm:px-4 md:px-6",
  default: "px-4 sm:px-6 lg:px-8",
} as const

type PageContainerSize = keyof typeof SIZE_MAP
type PageContainerPadding = keyof typeof PADDING_MAP

type PageContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: PageContainerSize
  padding?: PageContainerPadding
  asChild?: boolean
}

export function PageContainer({
  className,
  size = "comfortable",
  padding = "default",
  asChild = false,
  children,
  ...props
}: PageContainerProps) {
  const Component = asChild ? Slot : "div"

  return (
    <Component
      className={cn(
        "mx-auto w-full",
        SIZE_MAP[size],
        PADDING_MAP[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
