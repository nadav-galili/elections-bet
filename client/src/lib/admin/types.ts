export type Bloc = 'A' | 'B' | 'UNALIGNED';

export type ResultsStatus = 'NONE' | 'PROVISIONAL' | 'FINAL';

export interface Election {
  id: string;
  nameHe: string;
  lockAt: string | null;
  revealAt: string | null;
  resultsStatus: ResultsStatus;
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
}
