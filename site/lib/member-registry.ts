export type EligibilityMode = 'default' | 'allow' | 'block';
export type MemberSummary = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  source: string;
  created_at: string;
  assigned_count: number;
  assigned_codes: { code: string; title: string; assigned_at: string }[];
};
export type Assignment = {
  inventory_id: string;
  family: string;
  title: string;
  code: string;
  assigned_at: string;
  source: string;
  kind: 'claim' | 'legacy';
};
export type Reservation = Omit<Assignment, 'inventory_id' | 'kind'> & { id: string; email: string };
export type Eligibility = {
  family: string;
  title: string;
  mode: EligibilityMode;
  eligible: boolean;
  allocation_open: boolean;
};
export type MemberDetail = Omit<MemberSummary, 'assigned_count' | 'assigned_codes'> & {
  is_admin: boolean;
  registrations: { event: string; status: string; source_record: string }[];
  assignments: Assignment[];
  eligibility: Eligibility[];
  audit: {
    id: number;
    actor: string | null;
    action: string;
    created_at: string;
    details: {
      reason?: string;
      family?: string;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown>;
    };
  }[];
};
export type RegistryFilters = {
  search: string;
  event: string;
  status: 'all' | 'active' | 'suspended';
  family: string;
  assignment: 'all' | 'assigned' | 'unassigned';
  page: number;
  view: 'members' | 'reservations';
};
type RegistryPage = {
  total: number;
  page: number;
  page_size: number;
  events: string[];
  families: { slug: string; title: string }[];
};
export type RegistryResult = RegistryPage &
  ({ view: 'members'; items: MemberSummary[] } | { view: 'reservations'; items: Reservation[] });
