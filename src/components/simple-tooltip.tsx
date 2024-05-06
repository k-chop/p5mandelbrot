import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type Props = {
  children: React.ReactNode;
  content: React.ReactNode;
};

export const SimpleTooltip = ({ children, content }: Props) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent align="center">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
