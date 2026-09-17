import React from "react";
import { Badge } from "@/components/ui/badge";

export function RankBadge({ rank, className = "" }: { rank: string | undefined | null; className?: string }) {
  if (!rank) return null;
  
  const rankLower = rank.toLowerCase();
  let colorClass = "bg-gray-500/10 text-gray-400 border-gray-500/20";
  
  if (rankLower.includes("operator")) {
    colorClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (rankLower.includes("insider")) {
    colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  return (
    <Badge variant="outline" className={`font-mono uppercase tracking-wider text-[10px] ${colorClass} ${className}`}>
      {rank}
    </Badge>
  );
}
