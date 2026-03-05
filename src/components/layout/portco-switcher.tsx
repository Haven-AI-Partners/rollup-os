"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortcoSwitcherProps {
  portcos: Array<{ id: string; name: string; slug: string; industry: string | null }>;
  currentPortco: { id: string; name: string; slug: string; industry: string | null };
}

export function PortcoSwitcher({ portcos, currentPortco }: PortcoSwitcherProps) {
  const router = useRouter();

  return (
    <Select
      value={currentPortco.slug}
      onValueChange={(slug) => {
        router.push(`/${slug}/dashboard`);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select PortCo" />
      </SelectTrigger>
      <SelectContent>
        {portcos.map((portco) => (
          <SelectItem key={portco.id} value={portco.slug}>
            {portco.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
