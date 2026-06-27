/** A group as returned by `GET /api/groups` (list view). */
export interface Group {
  id: string;
  nameHe: string;
  adminUserId: string;
  inviteToken: string;
  createdAt: string;
  _count?: {
    memberships: number;
  };
}

export interface ActiveElection {
  id: string;
  nameHe: string;
  lockAt: string | null;
  revealAt: string | null;
}

/** Base shape every membership carries, regardless of phase. */
export interface GroupMemberBase {
  id: string;
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

/** A single party prediction inside a member's revealed pick. */
export interface PickEntry {
  partyId: string;
  mandates: number;
  party: {
    nameHe: string;
    logoUrl: string | null;
  };
}

/** 'no_active': just the roster, no pick info. */
export type NoActiveMember = GroupMemberBase;

/** 'pre_reveal': status only — never numbers. */
export interface PreRevealMember extends GroupMemberBase {
  pickStatus: 'submitted' | 'pending';
}

/** 'post_reveal': full pick is visible. */
export interface PostRevealMember extends GroupMemberBase {
  pickStatus: 'submitted' | 'pending';
  pick: {
    submittedAt: string | null;
    entries: PickEntry[];
  } | null;
}

interface GroupDetailBase extends Group {
  currentUserId: string;
}

/** Discriminated union on `privacyPhase` — mandate access is only type-safe in post_reveal. */
export type GroupDetail =
  | (GroupDetailBase & {
      privacyPhase: 'no_active';
      activeElection: null;
      memberships: NoActiveMember[];
    })
  | (GroupDetailBase & {
      privacyPhase: 'pre_reveal';
      activeElection: ActiveElection;
      memberships: PreRevealMember[];
    })
  | (GroupDetailBase & {
      privacyPhase: 'post_reveal';
      activeElection: ActiveElection;
      memberships: PostRevealMember[];
    });

export interface CreateGroupInput {
  nameHe: string;
}

export interface UpdateGroupInput {
  nameHe?: string;
  adminUserId?: string;
}
