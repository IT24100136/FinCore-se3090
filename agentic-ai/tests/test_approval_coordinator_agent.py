import pytest
from pydantic import ValidationError
from agents.approval_coordinator_agent import (
    ApprovalCoordinatorAgent,
    FraudAssessmentInput,
    CoordinatorResult
)

@pytest.fixture
def coordinator():
    return ApprovalCoordinatorAgent()


@pytest.mark.asyncio
async def test_coordinator_auto_approve_low_risk(coordinator):
    """Low risk (<50) transactions are automatically approved for settlement."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1001",
        amount=5000.0,
        risk_score=25.0,
        flag_reasons=["Normal transaction velocity"],
        sender_id="USR-1",
        receiver_id="USR-2"
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "APPROVED"
    assert result.action_taken == "AUTO_APPROVE"
    assert result.requires_human_approval is False
    assert result.requires_step_up is False


@pytest.mark.asyncio
async def test_coordinator_step_up_borderline_risk(coordinator):
    """Borderline risk (50 <= score < 70) halts settlement for customer step-up biometric/number match."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1002",
        amount=12000.0,
        risk_score=58.0,
        flag_reasons=["New device detected"],
        sender_id="USR-1",
        receiver_id="USR-3"
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "HELD_FOR_STEP_UP"
    assert result.action_taken == "STEP_UP_CHALLENGE"
    assert result.requires_step_up is True
    assert result.requires_human_approval is False


@pytest.mark.asyncio
async def test_coordinator_escalate_high_risk(coordinator):
    """High risk (>= 70) halts automated settlement and enqueues to Human Analyst."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1003",
        amount=35000.0,
        risk_score=85.0,
        flag_reasons=["Impossible travel: 1250 km/h detected between consecutive logins"],
        sender_id="USR-1",
        receiver_id="USR-4"
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "HELD_FOR_REVIEW"
    assert result.action_taken == "ESCALATE_TO_ANALYST"
    assert result.requires_human_approval is True
    assert result.priority_label in ("HIGH", "CRITICAL")


@pytest.mark.asyncio
async def test_coordinator_structuring_pattern_escalation(coordinator):
    """Structuring / smurfing keywords trigger immediate escalation regardless of raw risk score."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1004",
        amount=9500.0,
        risk_score=40.0,  # normally auto-approve, but structuring pattern present
        flag_reasons=["Structuring pattern detected: frequent transfers just below reporting limits"],
        sender_id="USR-2",
        receiver_id="USR-5"
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "HELD_FOR_REVIEW"
    assert result.action_taken == "ESCALATE_TO_ANALYST"
    assert result.requires_human_approval is True
    assert result.details.get("structuring_detected") is True


@pytest.mark.asyncio
async def test_coordinator_statutory_dual_approval(coordinator):
    """Transactions >= Rs. 75,000 strictly enforce statutory dual-approval escalation."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1005",
        amount=85000.0,  # >= 75,000 LKR Statutory Dual Approval
        risk_score=15.0,  # very low behavioral risk, but statutory law mandates approval
        flag_reasons=["Statutory Dual Approval Threshold (>= 75,000 LKR)"],
        sender_id="USR-3",
        receiver_id="USR-6"
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "HELD_FOR_REVIEW"
    assert result.action_taken == "ESCALATE_TO_ANALYST"
    assert result.requires_human_approval is True
    assert result.details.get("dual_approval_required") is True
    assert result.priority_label == "CRITICAL"


@pytest.mark.asyncio
async def test_circuit_breaker_low_value(coordinator):
    """During upstream AI outage, low value (< 25,000 LKR) passes deterministic fallback."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1006",
        amount=15000.0,
        risk_score=0.0,
        flag_reasons=[],
        sender_id="USR-1",
        receiver_id="USR-2",
        is_outage_fallback=True
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "APPROVED"
    assert result.action_taken == "DETERMINISTIC_FALLBACK_APPROVED"
    assert result.requires_human_approval is False


@pytest.mark.asyncio
async def test_circuit_breaker_high_value_held(coordinator):
    """During upstream AI outage, high value (>= 25,000 LKR) is held for manual review."""
    assessment = FraudAssessmentInput(
        transaction_id="TX-1007",
        amount=30000.0,
        risk_score=0.0,
        flag_reasons=[],
        sender_id="USR-1",
        receiver_id="USR-2",
        is_outage_fallback=True
    )
    result = await coordinator.evaluate_and_coordinate(assessment)
    assert result.status == "HELD_FOR_REVIEW"
    assert result.action_taken == "ESCALATE_TO_ANALYST"
    assert result.requires_human_approval is True
    assert "AI_SERVICE_UNAVAILABLE" in result.tag


def test_pydantic_schema_validation():
    """Verify deterministic Pydantic schema validation guardrails."""
    # Invalid score > 100
    with pytest.raises(ValidationError):
        FraudAssessmentInput(
            transaction_id="TX-FAIL",
            amount=500.0,
            risk_score=150.0,
            sender_id="USR-1",
            receiver_id="USR-2"
        )

    # Valid schema with 'reasons' alias
    valid = FraudAssessmentInput(
        transaction_id="TX-VALID",
        amount=100.0,
        risk_score=10.0,
        reasons=["Normal"],
        sender_id="USR-1",
        receiver_id="USR-2"
    )
    assert valid.flag_reasons == ["Normal"]
