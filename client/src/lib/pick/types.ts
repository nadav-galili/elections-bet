export type Bloc = 'A' | 'B' | 'UNALIGNED';

export type ResultsStatus = 'NONE' | 'PROVISIONAL' | 'FINAL';

export interface PlayerElection {
  id: string;
  nameHe: string;
  lockAt: string | null;
  revealAt: string | null;
  resultsStatus: ResultsStatus;
}

export interface PlayerParty {
  id: string;
  nameHe: string;
  logoUrl: string | null;
  bloc: Bloc;
  displayOrder: number;
}

export interface PlayerElectionDetail extends PlayerElection {
  blocALabel: string | null;
  blocBLabel: string | null;
  parties: PlayerParty[];
}

export interface PickEntry {
  partyId: string;
  mandates: number;
}

export interface Pick {
  entries: PickEntry[];
  submittedAt: string | null;
}
