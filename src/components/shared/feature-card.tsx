"use client";

import Link from "next/link";
import { cn } from "@/src/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import {
  Stethoscope,
  Baby,
  Pill,
  Home,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Stethoscope,
  Baby,
  Pill,
  Home,
};

interface FeatureCardProps {
  name: string;
  description: string;
  icon: string;
  href: string | null;
  available: boolean;
}

export function FeatureCard({
  name,
  description,
  icon,
  href,
  available,
}: FeatureCardProps) {
  const Icon = iconMap[icon] || Stethoscope;

  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        available
          ? "cursor-pointer hover:border-primary/40 hover:shadow-md"
          : "cursor-not-allowed opacity-60"
      )}
    >
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            available
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{name}</CardTitle>
            {!available && (
              <Badge variant="secondary" className="text-[10px]">
                Segera Hadir
              </Badge>
            )}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>

        {available && (
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        )}
      </CardHeader>
    </Card>
  );

  if (!available || !href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}
