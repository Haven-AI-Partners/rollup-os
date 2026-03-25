"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { CheckCircle, Star } from "lucide-react";

const FEEDBACK_TAGS = [
  { id: "felt_natural", label: "自然な会話だった" },
  { id: "helpful", label: "役に立った" },
  { id: "too_many_questions", label: "質問が多すぎた" },
  { id: "confusing", label: "分かりにくかった" },
  { id: "too_slow", label: "テンポが遅かった" },
  { id: "too_fast", label: "テンポが速かった" },
] as const;

interface SessionFeedbackProps {
  sessionId: string;
  employeeName: string;
}

export function SessionFeedback({ sessionId: _sessionId, employeeName }: SessionFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          tags: selectedTags,
          comment: comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle className="mx-auto mb-4 size-12 text-green-600" />
          <h2 className="text-lg font-semibold">ありがとうございました！</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            フィードバックを受け付けました。
            <br />
            {employeeName}さん、お疲れ様でした。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold">ヒアリングお疲れ様でした</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            今回のヒアリングについてフィードバックをお聞かせください
          </p>
        </div>

        {/* Star Rating */}
        <div className="flex justify-center gap-1 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`size-8 ${
                  star <= (hoveredStar || rating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {FEEDBACK_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                selectedTags.includes(tag.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Comment */}
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="その他のご意見（任意）"
          className="mb-4 resize-none"
          rows={3}
        />

        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full"
        >
          {submitting ? "送信中..." : "フィードバックを送信"}
        </Button>

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          スキップする
        </button>
      </Card>
    </div>
  );
}
