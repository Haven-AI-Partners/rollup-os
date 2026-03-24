"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/lib/actions/deals";
import { formatDateTime } from "@/lib/format";

interface Comment {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
}

interface CommentListProps {
  dealId: string;
  portcoId: string;
  portcoSlug: string;
  initialComments: Comment[];
}

export function CommentList({ dealId, portcoId, portcoSlug, initialComments }: CommentListProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await addComment(dealId, portcoId, portcoSlug, content.trim());
      setContent("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={loading || !content.trim()}>
            {loading ? "Posting..." : "Comment"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {initialComments.map((comment) => (
          <div key={comment.id} className="rounded-md border p-3">
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt)}
            </p>
          </div>
        ))}
        {initialComments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
