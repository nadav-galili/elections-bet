export interface Group {
  id: string
  nameHe: string
  adminUserId: string
  inviteToken: string
  createdAt: string
  _count?: {
    memberships: number
  }
}

export interface PickEntry {
  partyId: string
  mandates: number
  party?: {
    nameHe: string
    logoUrl: string | null
    bloc: string
  }
}

export interface GroupMember {
  id: string
  userId: string
  groupId: string
  joinedAt: string
  user: {
    id: string
    displayName: string | null
    avatarUrl: string | null
  }
  pickStatus?: 'submitted' | 'pending' | 'no_active_election'
  pick?: {
    submittedAt: string | null
    entries?: PickEntry[]
  }
}

export interface GroupDetail extends Group {
  memberships: GroupMember[]
  activeElection?: {
    id: string
    nameHe: string
    lockAt: string | null
    revealAt: string | null
  } | null
  privacyPhase?: 'pre_reveal' | 'post_reveal' | 'no_active'
}

export interface CreateGroupInput {
  nameHe: string
}

export interface UpdateGroupInput {
  nameHe?: string
  adminUserId?: string
}

export interface JoinGroupInput {
  inviteToken: string
}