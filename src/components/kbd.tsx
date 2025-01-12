import { cn } from "@/shadcn/utils";
import { cva } from "class-variance-authority";

type Props = {
  children: React.ReactNode;
  className?: string;
};

const kbdVariants = cva(
  "rounded-md border-2 bg-muted p-1 text-xs font-bold text-muted-foreground",
);

export const Kbd = ({ className, children }: Props) => (
  <span className={cn(kbdVariants(), className)}>{children}</span>
);
