import { Injectable } from "@nestjs/common";
import { PolicyEffect, PolicyRule, PolicyTarget, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimePublisher } from "../realtime/realtime.publisher";

interface PolicyEvaluationInput {
  target: PolicyTarget;
  actorUserId?: string | null;
  actorRole?: string | null;
  request?: {
    id?: string;
    type?: string;
  } | null;
  impact?: {
    riskScore?: number;
    blockingIssues?: number;
    warningIssues?: number;
  } | null;
  context?: Record<string, unknown>;
  policies?: PolicyRule[];
}

export interface PolicyRuleDecision {
  policyId: string;
  policyName: string;
  effect: PolicyEffect;
  matched: boolean;
  allowed: boolean;
  reason: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reasons: string[];
  decisions: PolicyRuleDecision[];
}

@Injectable()
export class PolicyEngineService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly realtimePublisher: RealtimePublisher
  ) {}

  async evaluate(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
    const policies =
      input.policies ??
      (await this.prismaService.policyRule.findMany({
        where: {
          target: input.target,
          active: true,
          enabled: true
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
      }));

    const decisions: PolicyRuleDecision[] = [];

    for (const policy of policies) {
      const decision = this.evaluatePolicy(policy, input);
      decisions.push(decision);
    }

    const violations = decisions.filter((decision) => !decision.allowed);

    return {
      allowed: violations.length === 0,
      reasons: violations.map((decision) => decision.reason),
      decisions
    };
  }

  async evaluateAndLog(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
    const result = await this.evaluate(input);

    if (result.decisions.length > 0) {
      await this.prismaService.policyEvaluationLog.createMany({
        data: result.decisions.map((decision) => ({
          policyId: decision.policyId,
          requestId: input.request?.id ?? null,
          actorUserId: input.actorUserId ?? null,
          target: input.target,
          allowed: decision.allowed,
          reason: decision.reason,
          contextJson: {
            actorRole: input.actorRole ?? null,
            requestType: input.request?.type ?? null,
            impact: input.impact ?? null,
            extra: input.context ?? null,
            matched: decision.matched
          } as Prisma.InputJsonValue
        }))
      });
    }

    if (!result.allowed) {
      await this.realtimePublisher.publishGovernance("policy.violation", {
        requestId: input.request?.id ?? null,
        target: input.target,
        reasons: result.reasons
      }, "governance");
    }

    return result;
  }

  private evaluatePolicy(policy: PolicyRule, input: PolicyEvaluationInput): PolicyRuleDecision {
    const conditions = this.readConditions(policy.conditionsJson);

    let matched = false;
    let reason = `Policy ${policy.name} skipped`;

    const maxRiskScore = this.readNumber(conditions.maxRiskScore);
    if (maxRiskScore != null && (input.impact?.riskScore ?? 0) > maxRiskScore) {
      matched = true;
      reason = `Risk score ${input.impact?.riskScore ?? 0} exceeds limit ${maxRiskScore}`;
    }

    const maxBlockingIssues = this.readNumber(conditions.maxBlockingIssues);
    if (maxBlockingIssues != null && (input.impact?.blockingIssues ?? 0) > maxBlockingIssues) {
      matched = true;
      reason = `Blocking issues ${input.impact?.blockingIssues ?? 0} exceed limit ${maxBlockingIssues}`;
    }

    const disallowedRequestTypes = this.readStringArray(conditions.disallowedRequestTypes);
    if (
      disallowedRequestTypes.length > 0 &&
      input.request?.type &&
      disallowedRequestTypes.includes(input.request.type)
    ) {
      matched = true;
      reason = `Request type ${input.request.type} is disallowed`;
    }

    const allowedRoles = this.readStringArray(conditions.allowedRoles);
    if (allowedRoles.length > 0 && input.actorRole && !allowedRoles.includes(input.actorRole)) {
      matched = true;
      reason = `Actor role ${input.actorRole} is not permitted`;
    }

    if (!matched) {
      return {
        policyId: policy.id,
        policyName: policy.name,
        effect: policy.effect,
        matched: false,
        allowed: true,
        reason
      };
    }

    if (policy.effect === PolicyEffect.deny) {
      return {
        policyId: policy.id,
        policyName: policy.name,
        effect: policy.effect,
        matched: true,
        allowed: false,
        reason
      };
    }

    return {
      policyId: policy.id,
      policyName: policy.name,
      effect: policy.effect,
      matched: true,
      allowed: true,
      reason: `Allowed by policy ${policy.name}`
    };
  }

  private readConditions(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }
}
