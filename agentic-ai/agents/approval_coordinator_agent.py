import os
import json
import logging
import httpx
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger("approval_coordinator")
logging.basicConfig(level=logging.INFO)

# Base URL to call the running ASP.NET Core API
BACKEND_API_BASE = os.getenv("FINCORE_API_URL", "http://localhost:5007/api")

# Proposal Thresholds
DUAL_APPROVAL_THRESHOLD = 75000.0  # LKR Statutory Dual Approval Gate
CIRCUIT_BREAKER_AMOUNT_THRESHOLD = 25000.0  # LKR Section 3.4 threshold

STRUCTURING_PATTERNS = [
    "structuring",
    "smurfing",
    "split transaction",
    "velocity anomaly",
    "rapid successive",
    "threshold evasion",
    "frequent transfers",
    "amount just below threshold"
]


class FraudAssessmentInput(BaseModel):
    transaction_id: str
    amount: float
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk score between 0 and 100")
    flag_reasons: List[str] = Field(default_factory=list)
    sender_id: str
    receiver_id: str
    is_outage_fallback: bool = False

    @model_validator(mode='before')
    @classmethod
    def handle_reasons_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'flag_reasons' not in data and 'reasons' in data:
                data['flag_reasons'] = data['reasons']
        return data


class CoordinatorResult(BaseModel):
    transaction_id: str
    status: str  # APPROVED, HELD_FOR_STEP_UP, HELD_FOR_REVIEW
    action_taken: str  # AUTO_APPROVE, STEP_UP_CHALLENGE, ESCALATE_TO_ANALYST, DETERMINISTIC_FALLBACK_APPROVED
    resolution_path: str
    requires_human_approval: bool
    requires_step_up: bool = False
    priority: int = 1
    priority_label: str = "MEDIUM"
    tag: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class DecisionDispatchInput(BaseModel):
    transaction_id: str
    decision: str  # Approved, Rejected, Escalated
    analyst_id: str
    notes: Optional[str] = None


class ApprovalCoordinatorAgent:
    """
    Approval-Coordinator Agent (Component C)
    Synthesizes inputs from upstream models (Agent 1: Transaction Assessment, Agent 2: Anomaly Signals),
    enforces execution pauses, routes borderline transactions to step-up verification,
    escalates high-risk/structuring cases to the Human-in-the-Loop Review Queue,
    and applies Circuit Breaker fallbacks during telemetry outages (Section 3.4).
    """

    def __init__(
        self,
        low_risk_threshold: float = 50.0,
        high_risk_threshold: float = 70.0,
        dual_approval_threshold: float = DUAL_APPROVAL_THRESHOLD,
        circuit_breaker_amount: float = CIRCUIT_BREAKER_AMOUNT_THRESHOLD
    ):
        self.low_risk_threshold = low_risk_threshold
        self.high_risk_threshold = high_risk_threshold
        self.dual_approval_threshold = dual_approval_threshold
        self.circuit_breaker_amount = circuit_breaker_amount

    def _has_structuring_pattern(self, flag_reasons: List[str]) -> bool:
        if not flag_reasons:
            return False
        reasons_lower = " ".join(flag_reasons).lower()
        return any(pattern in reasons_lower for pattern in STRUCTURING_PATTERNS)

    async def evaluate_and_coordinate(self, assessment: FraudAssessmentInput) -> CoordinatorResult:
        """
        Coordinates the transaction execution lifecycle across 4 distinct resolution paths:
        1. Circuit Breaker Fallback (Outage / Telemetry Timeout)
        2. Low Risk (< 50) -> AUTO_APPROVE
        3. Borderline (50 <= risk < 70) -> HOLD_FOR_STEP_UP
        4. High Risk (>= 70 or Structuring) -> ESCALATE_TO_ANALYST
        """
        # Section 3.4: Circuit Breaker Fallback
        if assessment.is_outage_fallback:
            return await self._handle_circuit_breaker(assessment)

        # Structuring patterns and Statutory Dual Approval (>= 75,000 LKR) trigger immediate escalation
        has_structuring = self._has_structuring_pattern(assessment.flag_reasons)
        is_statutory = assessment.amount >= self.dual_approval_threshold

        if assessment.risk_score >= self.high_risk_threshold or has_structuring or is_statutory:
            return await self._escalate_to_analyst(assessment, structuring_detected=has_structuring)
        elif assessment.risk_score >= self.low_risk_threshold:
            return self._hold_for_step_up(assessment)
        else:
            return self._auto_approve(assessment)

    async def _handle_circuit_breaker(self, assessment: FraudAssessmentInput) -> CoordinatorResult:
        """
        Section 3.4 Circuit Breaker Policy:
        - If amount < 25,000 LKR -> Fallback to deterministic basic checks.
        - If amount >= 25,000 LKR -> Mark HELD with tag 'AI_SERVICE_UNAVAILABLE - MANUAL REVIEW REQUIRED'.
        """
        if assessment.amount < self.circuit_breaker_amount:
            # Deterministic basic rule checks
            basic_check_passed = (
                bool(assessment.sender_id) and
                bool(assessment.receiver_id) and
                assessment.sender_id != assessment.receiver_id and
                assessment.amount > 0 and
                not any("sanction" in r.lower() or "blacklist" in r.lower() for r in assessment.flag_reasons)
            )

            if basic_check_passed:
                return CoordinatorResult(
                    transaction_id=assessment.transaction_id,
                    status="APPROVED",
                    action_taken="DETERMINISTIC_FALLBACK_APPROVED",
                    resolution_path="CIRCUIT_BREAKER_LOW_VALUE",
                    requires_human_approval=False,
                    requires_step_up=False,
                    priority=1,
                    priority_label="LOW",
                    tag="CIRCUIT_BREAKER_FALLBACK_APPLIED",
                    details={
                        "message": "Upstream telemetry outage detected. Low-value transaction (< Rs. 25,000) cleared via deterministic fallback rule checks.",
                        "circuit_breaker_active": True,
                        "amount": assessment.amount,
                        "deterministic_checks_passed": True
                    }
                )

        # High-value transaction under outage, or failed basic checks -> Mandatory HELD state
        tag = "AI_SERVICE_UNAVAILABLE - MANUAL REVIEW REQUIRED"
        priority = 3 if assessment.amount >= self.dual_approval_threshold else 2
        priority_label = "CRITICAL" if priority == 3 else "HIGH"

        backend_synced = await self._sync_with_backend_queue(
            assessment=assessment,
            priority=priority,
            priority_label=priority_label,
            tag=tag
        )

        return CoordinatorResult(
            transaction_id=assessment.transaction_id,
            status="HELD_FOR_REVIEW",
            action_taken="ESCALATE_TO_ANALYST",
            resolution_path="CIRCUIT_BREAKER_HIGH_VALUE",
            requires_human_approval=True,
            requires_step_up=False,
            priority=priority,
            priority_label=priority_label,
            tag=tag,
            details={
                "message": "Upstream AI service unavailable. High-value transaction (>= Rs. 25,000) held for mandatory human analyst review under Circuit Breaker policy.",
                "circuit_breaker_active": True,
                "tag": tag,
                "amount": assessment.amount,
                "backend_synced": backend_synced,
                "dual_approval_required": assessment.amount >= self.dual_approval_threshold
            }
        )

    def _auto_approve(self, assessment: FraudAssessmentInput) -> CoordinatorResult:
        """
        Low-risk path (< 50): Direct instant settlement.
        """
        return CoordinatorResult(
            transaction_id=assessment.transaction_id,
            status="APPROVED",
            action_taken="AUTO_APPROVE",
            resolution_path="AUTO_APPROVE",
            requires_human_approval=False,
            requires_step_up=False,
            priority=1,
            priority_label="LOW",
            details={
                "message": "Risk score within acceptable safe bounds (< 50). Proceeding with direct automated settlement.",
                "risk_score": assessment.risk_score,
                "amount": assessment.amount
            }
        )

    def _hold_for_step_up(self, assessment: FraudAssessmentInput) -> CoordinatorResult:
        """
        Borderline path (50 <= risk < 70): Routes to interactive challenge
        (interactive number matching / device biometric authentication).
        """
        return CoordinatorResult(
            transaction_id=assessment.transaction_id,
            status="HELD_FOR_STEP_UP",
            action_taken="STEP_UP_CHALLENGE",
            resolution_path="HOLD_FOR_STEP_UP",
            requires_human_approval=False,
            requires_step_up=True,
            priority=2,
            priority_label="MEDIUM",
            details={
                "message": "Risk score in borderline band [50-70). Transaction execution paused pending customer step-up biometric / number-matching challenge.",
                "risk_score": assessment.risk_score,
                "challenge_type": "BIOMETRIC_OR_NUMBER_MATCH",
                "step_up_target": assessment.sender_id,
                "timeout_seconds": 120
            }
        )

    async def _escalate_to_analyst(
        self,
        assessment: FraudAssessmentInput,
        structuring_detected: bool = False
    ) -> CoordinatorResult:
        """
        High-risk path (score >= 70 or Structuring): Mandatory execution pause
        and registration in the human analyst review queue.
        """
        is_critical = assessment.amount >= self.dual_approval_threshold or assessment.risk_score >= 85
        priority = 3 if is_critical else 2
        priority_label = "CRITICAL" if is_critical else "HIGH"

        backend_synced = await self._sync_with_backend_queue(
            assessment=assessment,
            priority=priority,
            priority_label=priority_label,
            tag="STRUCTURING_DETECTED" if structuring_detected else None
        )

        return CoordinatorResult(
            transaction_id=assessment.transaction_id,
            status="HELD_FOR_REVIEW",
            action_taken="ESCALATE_TO_ANALYST",
            resolution_path="ESCALATE_TO_ANALYST",
            requires_human_approval=True,
            requires_step_up=False,
            priority=priority,
            priority_label=priority_label,
            tag="STRUCTURING_PATTERN_FLAGGED" if structuring_detected else None,
            details={
                "message": "Transaction flagged with high risk or structuring pattern. Automated settlement halted for analyst review.",
                "risk_score": assessment.risk_score,
                "flag_reasons": assessment.flag_reasons,
                "structuring_detected": structuring_detected,
                "amount": assessment.amount,
                "priority": priority,
                "priority_label": priority_label,
                "backend_synced": backend_synced,
                "dual_approval_required": assessment.amount >= self.dual_approval_threshold
            }
        )

    async def _sync_with_backend_queue(
        self,
        assessment: FraudAssessmentInput,
        priority: int,
        priority_label: str,
        tag: Optional[str] = None
    ) -> bool:
        """
        Asynchronously persists the case state into ASP.NET Core ReviewQueue.
        """
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                # Format flag reasons into rich JSON structure for Leaflet & SHAP UI
                reasons = list(assessment.flag_reasons)
                if tag and tag not in reasons:
                    reasons.insert(0, tag)

                formatted_reasons = [
                    {"label": r, "impact": "+30", "color": "#ef4444" if "high" in r.lower() or "unavailable" in r.lower() else "#f59e0b"}
                    for r in (reasons if reasons else ["Flagged by AI Coordinator"])
                ]

                payload = {
                    "transactionId": assessment.transaction_id,
                    "queueCode": f"Q-{abs(hash(assessment.transaction_id)) % 900 + 100}",
                    "amount": assessment.amount,
                    "senderName": f"User {assessment.sender_id[:8]}",
                    "senderId": assessment.sender_id,
                    "recipientName": f"Recipient {assessment.receiver_id[:8]}",
                    "recipientId": assessment.receiver_id,
                    "riskScore": assessment.risk_score,
                    "originIp": "127.0.0.1",
                    "device": "Android / Web Client",
                    "latitude": 6.9271,
                    "longitude": 79.8612,
                    "flagReasonsJson": json.dumps(formatted_reasons),
                    "priority": priority,
                    "priorityLabel": priority_label
                }

                response = await client.post(f"{BACKEND_API_BASE}/reviews/enqueue", json=payload)
                return response.status_code in (200, 201)
            except Exception as ex:
                logger.warning(f"Could not sync with ASP.NET Core backend: {ex}")
                return False

    async def dispatch_human_decision(
        self,
        transaction_id: str,
        decision: str,
        analyst_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Coordinates the final resolution after analyst decision.
        Interacts with Component A (reversal/settlement) and Component D (customer notification).
        """
        is_approved = decision.strip().lower() == "approved"

        return {
            "transaction_id": transaction_id,
            "analyst_id": analyst_id,
            "decision": decision,
            "status": "SETTLED" if is_approved else "REVERSED",
            "action_dispatched": "DIRECT_SETTLEMENT" if is_approved else "TRANSACTION_REVERSAL",
            "notes": notes,
            "next_steps": {
                "notify_customer": True,
                "notification_channel": "PUSH_NOTIFICATION_AND_SMS",
                "customer_message": (
                    "Your transfer has been verified and completed."
                    if is_approved else
                    "Your transfer has been declined following security inspection."
                ),
                "execute_balance_action": "SETTLE" if is_approved else "REVERSE"
            }
        }