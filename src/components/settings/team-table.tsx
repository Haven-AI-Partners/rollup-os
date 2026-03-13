"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserMinus } from "lucide-react";
import { updateMemberRole, removeMember } from "@/lib/actions/team";
import type { UserRole } from "@/lib/auth";

interface Member {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  role: string;
  membershipId: string;
  joinedAt: Date;
}

interface TeamTableProps {
  members: Member[];
  currentUserId: string;
  currentUserRole: UserRole;
  portcoId: string;
  portcoSlug: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analyst",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  analyst: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

function formatRelativeDate(date: Date | null) {
  if (!date) return "Never";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function getRolesForEditor(currentRole: UserRole): UserRole[] {
  if (currentRole === "owner") return ["owner", "admin", "analyst", "viewer"];
  if (currentRole === "admin") return ["analyst", "viewer"];
  return [];
}

export function TeamTable({
  members,
  currentUserId,
  currentUserRole,
  portcoId,
  portcoSlug,
}: TeamTableProps) {
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const availableRoles = getRolesForEditor(currentUserRole);

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2.5 text-left font-medium">Member</th>
            <th className="px-4 py-2.5 text-left font-medium">Role</th>
            <th className="px-4 py-2.5 text-left font-medium">Last Login</th>
            <th className="px-4 py-2.5 text-left font-medium">Joined</th>
            {canManage && <th className="px-4 py-2.5 text-right font-medium w-12" />}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canManage={canManage}
              availableRoles={availableRoles}
              portcoId={portcoId}
              portcoSlug={portcoSlug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({
  member,
  currentUserId,
  currentUserRole,
  canManage,
  availableRoles,
  portcoId,
  portcoSlug,
}: {
  member: Member;
  currentUserId: string;
  currentUserRole: UserRole;
  canManage: boolean;
  availableRoles: UserRole[];
  portcoId: string;
  portcoSlug: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isMe = member.id === currentUserId;
  const memberRole = member.role as UserRole;

  // Can edit if: canManage, not self, and target role is lower (or I'm owner)
  const canEdit =
    canManage &&
    !isMe &&
    (currentUserRole === "owner" || !isOwnerOrAdmin(memberRole, currentUserRole));

  function isOwnerOrAdmin(targetRole: UserRole, myRole: UserRole) {
    const hierarchy: Record<UserRole, number> = { owner: 4, admin: 3, analyst: 2, viewer: 1 };
    return hierarchy[targetRole] >= hierarchy[myRole];
  }

  function handleRoleChange(newRole: string) {
    startTransition(async () => {
      try {
        await updateMemberRole(member.membershipId, portcoId, portcoSlug, newRole as UserRole);
      } catch (e) {
        console.error("Failed to update role:", e);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeMember(member.membershipId, portcoId, portcoSlug);
      } catch (e) {
        console.error("Failed to remove member:", e);
      }
    });
  }

  return (
    <tr className={`border-b last:border-0 ${isPending ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={member.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(member.fullName, member.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {member.fullName || member.email.split("@")[0]}
              </span>
              {isMe && (
                <Badge variant="outline" className="text-[10px]">
                  You
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {canEdit ? (
          <Select value={member.role} onValueChange={handleRoleChange} disabled={isPending}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role} className="text-xs">
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="outline"
            className={`text-xs ${ROLE_COLORS[member.role] ?? ""}`}
          >
            {ROLE_LABELS[member.role] ?? member.role}
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatRelativeDate(member.lastLoginAt)}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(member.joinedAt).toLocaleDateString()}
      </td>
      {canManage && (
        <td className="px-4 py-3 text-right">
          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={isPending}
                >
                  <UserMinus className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove {member.fullName || member.email} from this PortCo? They
                    will lose access immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </td>
      )}
    </tr>
  );
}
