import { Cluster, Department } from '../types';

export const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'dept-roads',
    name: 'Department of Roads & Infrastructure Maintenance',
    categories: ['pothole'],
    email: 'roads-triage@citygov.org',
    escalation_email: 'chief-engineer-roads@citygov.org',
    sla_hours_base: 48,
  },
  {
    id: 'dept-sanitation',
    name: 'Solid Waste Management & Sanitation Board',
    categories: ['garbage'],
    email: 'sanitation-ops@citygov.org',
    escalation_email: 'director-sanitation@citygov.org',
    sla_hours_base: 24,
  },
  {
    id: 'dept-water',
    name: 'Municipal Water Supply & Sewerage Board',
    categories: ['water_leak', 'sewage_drain'],
    email: 'water-sewerage@citygov.org',
    escalation_email: 'superintendent-water@citygov.org',
    sla_hours_base: 24,
  },
  {
    id: 'dept-electrical',
    name: 'City Electricity Distribution & Streetlighting',
    categories: ['electrical_hazard', 'streetlight'],
    email: 'power-grid-alerts@citygov.org',
    escalation_email: 'executive-engineer-power@citygov.org',
    sla_hours_base: 12,
  },
  {
    id: 'dept-horticulture',
    name: 'Parks & Disaster Emergency Task Force',
    categories: ['fallen_tree', 'other'],
    email: 'parks-emergency@citygov.org',
    escalation_email: 'commissioner-disaster@citygov.org',
    sla_hours_base: 36,
  },
];

// Completely clean: Zero dummy / mock complaints. Only real user-submitted reports.
export const INITIAL_CLUSTERS: Cluster[] = [];
