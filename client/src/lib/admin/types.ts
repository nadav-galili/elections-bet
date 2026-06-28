export type Bloc = 'A' | 'B' | 'UNALIGNED';

export type ResultsStatus = 'NONE' | 'PROVISIONAL' | 'FINAL';

export interface Election {
  id: string;
  nameHe: string;
  lockAt: string | null;
  revealAt: string | null;
  resultsStatus: ResultsStatus;
  resultsPublishedAt?: string | null;
  blocALabel: string | null;
  blocBLabel: string | null;
  createdAt: string;
  _count?: { parties: number };
}

export interface Party {
  id: string;
  electionId: string;
  nameHe: string;
  logoUrl: string | null;
  bloc: Bloc;
  displayOrder: number;
  actualMandates: number | null;
  /** Prior baseline for the "biggest movers" story. null = no delta; 0 = new entrant. */
  baselineMandates: number | null;
}

export type ElectionDetail = Election & { parties: Party[] };

/** Payload sent to the API when creating/updating an election. */
export interface ElectionInput {
  nameHe: string;
  lockAt: string | null;
  revealAt: string | null;
  blocALabel: string | null;
  blocBLabel: string | null;
}

/** Payload sent to the API when creating/updating a party. */
export interface PartyInput {
  nameHe: string;
  logoUrl: string | null;
  bloc: Bloc;
  displayOrder: number;
  baselineMandates: number | null;
}

/** A single party's actual result, sent when setting election results. */
export interface ResultEntry {
  partyId: string;
  actualMandates: number;
}

export type Role = 'USER' | 'SUPER_ADMIN';

/** A group as seen in the super-admin god-mode group management table. */
export interface AdminGroup {
  id: string;
  nameHe: string;
  createdAt: string;
  admin: { id: string; displayName: string | null; email: string | null } | null;
  memberCount: number;
}

/** One membership row in the god-mode group detail (for reassign/remove). */
export interface AdminGroupMember {
  id: string;
  userId: string;
  joinedAt: string;
  user: { id: string; displayName: string | null; email: string | null; avatarUrl: string | null };
}

/** A single group with its full roster, served from the admin surface. */
export interface AdminGroupDetail {
  id: string;
  nameHe: string;
  adminUserId: string;
  createdAt: string;
  memberships: AdminGroupMember[];
}

/** A user as seen in the super-admin god-mode user management table. */
export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  bannedAt: string | null;
  createdAt: string;
}

/** Aggregate stats shown on the super-admin overview dashboard. */
export interface AdminOverview {
  users: number;
  groups: number;
  elections: number;
  activeElection: { id: string; nameHe: string } | null;
  picksSubmitted: number;
  participationRate: number;
}
