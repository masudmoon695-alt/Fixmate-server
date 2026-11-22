const ACTIVE_STATUSES = ['requested', 'accepted', 'in-progress'];

const technicianTransitions = {
  requested: ['accepted', 'rejected'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
};

export const BOOKING_STATUSES = [
  'requested',
  'accepted',
  'rejected',
  'in-progress',
  'completed',
  'cancelled',
];

export const ACTIVE_BOOKING_STATUSES = ACTIVE_STATUSES;

/** Only the technician endpoints use this map. Customers cancel separately. */
export function canTechnicianTransition(currentStatus, nextStatus) {
  return (technicianTransitions[currentStatus] || []).includes(nextStatus);
}

export function technicianNextStatuses(currentStatus) {
  return technicianTransitions[currentStatus] || [];
}
