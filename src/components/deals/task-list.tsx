"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Circle, Plus } from "lucide-react";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { TASK_STATUS_ICONS } from "@/lib/constants";

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: Date | null;
}

interface TaskListProps {
  dealId: string;
  portcoId: string;
  portcoSlug: string;
  initialTasks: Task[];
}

const CATEGORIES = [
  "sourcing",
  "evaluation",
  "dd_financial",
  "dd_legal",
  "dd_operational",
  "dd_tax",
  "dd_hr",
  "dd_it",
  "closing",
  "pmi_integration",
  "pmi_reporting",
  "other",
];

export function TaskList({ dealId, portcoId, portcoSlug, initialTasks }: TaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("evaluation");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await createTask(dealId, portcoId, portcoSlug, {
        title: newTitle.trim(),
        category: newCategory,
      });
      setNewTitle("");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(task: Task) {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    await updateTask(task.id, portcoSlug, dealId, { status: newStatus });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <Input
          placeholder="New task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1"
        />
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="icon" disabled={loading || !newTitle.trim()}>
          <Plus className="size-4" />
        </Button>
      </form>

      <div className="space-y-1">
        {initialTasks.map((task) => {
          const StatusIcon = TASK_STATUS_ICONS[task.status] ?? Circle;
          return (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <button
                onClick={() => handleToggleStatus(task)}
                className={`shrink-0 ${
                  task.status === "completed" ? "text-green-600" : "text-muted-foreground"
                }`}
              >
                <StatusIcon className="size-4" />
              </button>
              <span
                className={`flex-1 text-sm ${
                  task.status === "completed" ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {task.category.replace(/_/g, " ")}
              </Badge>
              <Badge
                variant={task.priority === "critical" ? "destructive" : "secondary"}
                className="text-[10px] capitalize"
              >
                {task.priority}
              </Badge>
            </div>
          );
        })}
        {initialTasks.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet.</p>
        )}
      </div>
    </div>
  );
}
