export const GOVERNANCE_PERMISSIONS = {
  REQUESTS_VIEW: "admin.requests.view",
  REQUESTS_CREATE_SCHEDULE_CHANGE: "admin.requests.create.schedule_change",
  REQUESTS_CREATE_ROOM_BOOKING: "admin.requests.create.room_booking",
  REQUESTS_SUBMIT: "admin.requests.submit",
  APPROVALS_VIEW: "admin.approvals.view",
  APPROVALS_DECIDE: "admin.approvals.decide",
  POLICIES_VIEW: "admin.policies.view",
  POLICIES_MANAGE: "admin.policies.manage"
} as const;

export const GOVERNANCE_SCOPE = {
  ALL: "all",
  OWN: "own",
  ASSIGNED: "assigned"
} as const;

export type GovernancePermissionKey = (typeof GOVERNANCE_PERMISSIONS)[keyof typeof GOVERNANCE_PERMISSIONS];
