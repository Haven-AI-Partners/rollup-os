"use client";

import dynamic from "next/dynamic";

const DealChat = dynamic(
  () => import("@/components/deals/deal-chat").then((m) => ({ default: m.DealChat })),
  { ssr: false },
);

export function DealChatLazy({ dealId }: { dealId: string }) {
  return <DealChat dealId={dealId} />;
}
