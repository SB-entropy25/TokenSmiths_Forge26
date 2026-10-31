export type IssueCategory = 
  | 'pothole'
  | 'garbage'
  | 'water_leak'
  | 'sewage_drain'
  | 'streetlight'
  | 'electrical_hazard'
  | 'fallen_tree'
  | 'other';

export type TicketStatus = 
  | 'under_verification'
  | 'received'
  | 'assigned'
  | 'in_progress'
  | 'closed'
  | 'reopened'
  | 'rejected';

export interface DangerAspects {
  risk_to_life: boolean;
  electrical_hazard: boolean;
  open_manhole_or_pit: boolean;
  blocks_emergency_access: boolean;
  traffic_hazard: boolean;
  water_or_flood_risk: boolean;
  health_hazard: boolean;
  worsens_over_time: boolean;
}

export interface ContextData {
  nearSchoolOrHospital?: boolean;
  rainForecast?: boolean;
  exifLocationDiffMeters?: number;
}

export interface TimelineEvent {
  id: string;
  cluster_id: string;
  ticket_id?: string;
  type: 'submitted' | 'ai_checked' | 'flagged' | 'assigned' | 'escalated' | 'reminder' | 'admin_message' | 'closed' | 'reopened';
  message: string;
  public: boolean;
  actor: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_code: string;
  cluster_id: string;
  name: string;
  email: string;
  mobile: string;
  category: IssueCategory;
  description: string;
  wide_photo_url: string;
  near_photo_url: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  ai_generated_score: number;
  ai_flag: boolean;
  severity_ai: number;
  severity_final: number;
  danger: DangerAspects;
  context?: ContextData;
  description_consistent: boolean;
  ai_summary: string;
  eta_hours: number;
  created_at: string;
}

export interface Cluster {
  id: string;
  category: IssueCategory;
  center_lat: number;
  center_lng: number;
  address: string;
  locality: string;
  severity_current: number; // 1 to 5
  flag_count: number; // number of citizen reports linked
  status: TicketStatus;
  department_name?: string;
  department_id?: string;
  eta_at?: string;
  last_escalated_at?: string;
  reminder_sent: boolean;
  closed_at?: string;
  proof_photo_url?: string;
  reopen_count: number;
  created_at: string;
  tickets?: Ticket[];
  timeline?: TimelineEvent[];
}

export interface Department {
  id: string;
  name: string;
  categories: IssueCategory[];
  email: string;
  escalation_email: string;
  sla_hours_base: number;
}

export interface SubmissionPayload {
  category: IssueCategory;
  description: string;
  name: string;
  email: string;
  mobile: string;
  lat: number;
  lng: number;
  accuracy: number;
  wide_photo: File | Blob;
  near_photo: File | Blob;
}

export interface SubmissionResponse {
  success: boolean;
  ticket_code: string;
  cluster_id: string;
  severity_final: number;
  eta_hours: number;
  status: TicketStatus;
  ai_summary: string;
  danger: DangerAspects;
  ai_generated_score?: number;
  portal_verdict?: 'accepted' | 'held' | 'rejected';
  ai_formal_description?: string;
  context?: ContextData;
  message?: string;
}
