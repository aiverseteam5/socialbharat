'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuthStore } from '@/stores/auth-store'

interface Member {
  id: string
  role: string
  invited_at: string
  accepted_at: string | null
  users: {
    id: string
    email: string | null
    phone: string | null
    full_name: string | null
    avatar_url: string | null
  }
}

export default function TeamSettingsPage() {
  const { role: currentRole } = useAuthStore()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/orgs/current/members')
      if (!response.ok) throw new Error('Failed to fetch members')
      const data = await response.json()
      setMembers(data.members || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch members')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    setInviteLoading(true)
    setError('')
    try {
      const response = await fetch('/api/orgs/current/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail || undefined,
          phone: invitePhone || undefined,
          role: inviteRole,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to invite member')
      setInviteDialogOpen(false)
      setInviteEmail('')
      setInvitePhone('')
      setInviteRole('viewer')
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/orgs/current/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update role')
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMember) return
    try {
      const response = await fetch(`/api/orgs/current/members/${selectedMember.users.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to remove member')
      setRemoveDialogOpen(false)
      setSelectedMember(null)
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const canManage = currentRole === 'owner' || currentRole === 'admin'
  const ownerCount = members.filter((m) => m.role === 'owner').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Settings</h1>
          <p className="text-muted-foreground">Manage your team members and permissions.</p>
        </div>
        {canManage && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>Invite Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Invite someone to join your team via email or phone.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="m@example.com"
                  />
                </div>
                <div className="text-sm text-muted-foreground">or</div>
                <div className="space-y-2">
                  <Label htmlFor="invitePhone">Phone</Label>
                  <Input
                    id="invitePhone"
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteRole">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="inviteRole">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviteLoading || (!inviteEmail && !invitePhone)}>
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email/Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No team members yet</TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.users.full_name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {member.users.email || member.users.phone || '-'}
                  </TableCell>
                  <TableCell>
                    {canManage && (member.role !== 'owner' || ownerCount > 1) ? (
                      <Select
                        value={member.role}
                        onValueChange={(newRole) => handleRoleChange(member.id, member.users.id, newRole)}
                        disabled={member.role === 'owner' && ownerCount <= 1}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {member.role === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize">{member.role}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.accepted_at
                      ? new Date(member.accepted_at).toLocaleDateString()
                      : 'Pending'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {member.role !== 'owner' || ownerCount > 1 ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedMember(member)
                            setRemoveDialogOpen(true)
                          }}
                          disabled={member.role === 'owner' && ownerCount <= 1}
                        >
                          Remove
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Cannot remove last owner</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.users.full_name || 'this member'} from the team?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
