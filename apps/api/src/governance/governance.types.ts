export interface RequestEvaluationJobPayload {
  requestId: string;
  submittedByUserId: string;
}

export type ApprovalNotificationJobPayload =
  | {
      kind: "approval_pending";
      requestId: string;
      approverUserId: string;
      requestTitle: string;
      requestType: string;
    }
  | {
      kind: "approval_decided";
      requestId: string;
      requesterUserId: string;
      decision: "approved" | "rejected";
      decisionNote?: string;
    }
  | {
      kind: "policy_violation";
      requestId: string;
      userId: string;
      reason: string;
    };
