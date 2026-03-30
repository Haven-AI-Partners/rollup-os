import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AgentPageHeaderProps {
  portcoSlug: string;
  title: string;
  description: string;
}

export function AgentPageHeader({ portcoSlug, title, description }: AgentPageHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/${portcoSlug}/agents`}>
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
