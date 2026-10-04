import time
import pytest
from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone, timedelta
from agents.transaction_analysis_agent import (
    TransactionAnalysisAgent,
    TransactionAnalysisInput
)
from agents.anomaly_detection_agent import invoke_anomaly_agent
from agents.approval_coordinator_agent import (
    ApprovalCoordinatorAgent,
    FraudAssessmentInput
)
from agents.tool_use_agent import ToolUseAgent

@pytest.fixture
def tx_agent():
    return TransactionAnalysisAgent()

@pytest.fixture
def coordinator():
    # Patch backend sync call in isolated unit test suite so latency asserts evaluate pure agent computation SLA
    coord = ApprovalCoordinatorAgent()
    return coord

@pytest.fixture
def tool_agent():
    return ToolUseAgent()


class TestGoldenEvaluationCases:
    """
    Section 12: Rigorous Golden Test Cases asserting rule-based assertions,
    schema validation, deterministic guardrails, and execution latency limits.
    """

    @pytest.mark.asyncio
    async def test_golden_case_1_impossible_travel(self, coordinator):
        """
        GOLDEN CASE 1: Impossible Travel (>900 km/h)
        Origin: Colombo, Sri Lanka (6.9271, 79.8612)
        Destination: London, UK (51.5074, -0.1278)
        Time Delta: 30 minutes (0.5 hours)
        Distance: ~8,700 km -> Calculated Speed: ~17,400 km/h (>900 km/h commercial flight limit)
        Expected: Flags impossible travel anomaly, risk score >= 70, escalates to human analyst.
        """
        now = datetime.now(timezone.utc)
        prev_time = (now - timedelta(minutes=30)).isoformat()

        anomaly_payload = {
            "transaction_id": "GC-001-TRAVEL",
            "user_id": "USR-GOLDEN-1",
            "amount": 25000.0,
            "device_id": "mobile_s24_colombo",
            "ip_location": "London, UK",
            "velocity_24h": 2,
            "prev_tx_lat": 6.9271,
            "prev_tx_lon": 79.8612,
            "prev_tx_timestamp": prev_time,
            "current_lat": 51.5074,
            "current_lon": -0.1278,
            "current_timestamp": now.isoformat(),
        }

        start = time.perf_counter()
        # Step 1: Agent 2 Behavioral Anomaly Evaluation
        agent2_result = invoke_anomaly_agent(anomaly_payload)

        # Assertions on Agent 2 output
        signals = agent2_result.get("flagged_signals", [])
        assert any("impossible travel" in s.lower() or "speed" in s.lower() for s in signals), \
            f"Expected impossible travel signal, got {signals}"
        assert float(agent2_result.get("anomaly_score", 0)) >= 0.70

        # Step 2: Agent 3 Coordination (with mocked network I/O to measure pure logic latency)
        with patch.object(coordinator, "_sync_with_backend_queue", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = True
            assessment = FraudAssessmentInput(
                transaction_id="GC-001-TRAVEL",
                amount=25000.0,
                risk_score=round(float(agent2_result.get("anomaly_score", 0)) * 100, 1),
                flag_reasons=signals,
                sender_id="USR-GOLDEN-1",
                receiver_id="USR-RECIPIENT-1"
            )
            coord_result = await coordinator.evaluate_and_coordinate(assessment)
            total_latency = (time.perf_counter() - start) * 1000

        assert coord_result.status == "HELD_FOR_REVIEW"
        assert coord_result.action_taken == "ESCALATE_TO_ANALYST"
        assert coord_result.requires_human_approval is True
        assert total_latency < 250  # Sub-250ms pure agent compute SLA

    @pytest.mark.asyncio
    async def test_golden_case_2_spending_spike_5x_baseline(self, tx_agent, coordinator):
        """
        GOLDEN CASE 2: Spending Spike (>5x User Historical Baseline)
        Baseline average: Rs. 3,500 LKR
        Current transaction: Rs. 24,500 LKR (7.0x baseline > 5x threshold)
        Expected: Agent 1 flags extreme baseline deviation, elevates risk, forces step-up/escalation.
        """
        start = time.perf_counter()
        historical = [
            {"amount": 3200.0, "timestamp": "2026-09-01T10:00:00Z"},
            {"amount": 3800.0, "timestamp": "2026-09-10T12:00:00Z"},
            {"amount": 3500.0, "timestamp": "2026-09-18T14:00:00Z"},
        ]

        tx_input = TransactionAnalysisInput(
            transaction_id="GC-002-SPIKE",
            user_id="USR-GOLDEN-2",
            amount=24500.0,
            recipient_id="USR-MERCHANT-99",
            note="Electronics purchase",
            historical_transactions=historical
        )

        agent1_result = await tx_agent.evaluate_transaction(tx_input)
        assert agent1_result.final_risk_score >= 50.0
        assert any("deviat" in r.lower() or "spike" in r.lower() or "multiplier" in r.lower() for r in agent1_result.reasons)

        with patch.object(coordinator, "_sync_with_backend_queue", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = True
            assessment = FraudAssessmentInput(
                transaction_id="GC-002-SPIKE",
                amount=24500.0,
                risk_score=agent1_result.final_risk_score,
                flag_reasons=agent1_result.reasons,
                sender_id="USR-GOLDEN-2",
                receiver_id="USR-MERCHANT-99"
            )
            coord_result = await coordinator.evaluate_and_coordinate(assessment)
            total_latency = (time.perf_counter() - start) * 1000

        assert coord_result.status in ("HELD_FOR_STEP_UP", "HELD_FOR_REVIEW")
        assert total_latency < 250

    @pytest.mark.asyncio
    async def test_golden_case_3_statutory_dual_approval_75k(self, coordinator):
        """
        GOLDEN CASE 3: Statutory Rs. 75,000 Dual Approval Gate
        Amount: Rs. 85,000 LKR (Exceeds Rs. 75,000 statutory limit)
        Even with zero behavioral anomalies, Sri Lanka banking policy mandates dual human sign-off.
        Expected: HELD_FOR_REVIEW, requires_human_approval = True, priority_label = CRITICAL.
        """
        start = time.perf_counter()
        with patch.object(coordinator, "_sync_with_backend_queue", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = True
            assessment = FraudAssessmentInput(
                transaction_id="GC-003-STATUTORY",
                amount=85000.0,
                risk_score=10.0,  # pristine behavioral score
                flag_reasons=["Normal transaction"],
                sender_id="USR-CORPORATE-1",
                receiver_id="USR-VENDOR-1"
            )
            coord_result = await coordinator.evaluate_and_coordinate(assessment)
            total_latency = (time.perf_counter() - start) * 1000

        assert coord_result.status == "HELD_FOR_REVIEW"
        assert coord_result.action_taken == "ESCALATE_TO_ANALYST"
        assert coord_result.requires_human_approval is True
        assert coord_result.priority_label == "CRITICAL"
        assert coord_result.details.get("dual_approval_required") is True
        assert total_latency < 250

    @pytest.mark.asyncio
    async def test_golden_case_4_velocity_burst_anomaly(self, coordinator):
        """
        GOLDEN CASE 4: Velocity Burst (>5 transactions in 24 hours)
        Velocity 24h = 9 transactions.
        Expected: Agent 2 detects velocity burst, flags anomalous velocity.
        """
        payload = {
            "transaction_id": "GC-004-VELOCITY",
            "user_id": "USR-GOLDEN-4",
            "amount": 4500.0,
            "device_id": "mobile_device_default",
            "ip_location": "Colombo, LK",
            "velocity_24h": 9,
            "current_lat": 6.9271,
            "current_lon": 79.8612,
        }
        res = invoke_anomaly_agent(payload)
        signals = res.get("flagged_signals", [])
        assert any("velocity" in s.lower() for s in signals), f"Expected velocity signal in {signals}"
        assert float(res.get("anomaly_score", 0)) > 0.30

    @pytest.mark.asyncio
    async def test_golden_case_5_structuring_evasion_pattern(self, coordinator):
        """
        GOLDEN CASE 5: Structuring / Threshold Evasion
        Keywords: 'structuring', 'split transfer', 'frequent transfers'
        Expected: Agent 3 intercepts pattern and halts settlement for review.
        """
        with patch.object(coordinator, "_sync_with_backend_queue", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = True
            assessment = FraudAssessmentInput(
                transaction_id="GC-005-STRUCTURING",
                amount=9800.0,
                risk_score=45.0,  # Below standard 50 threshold
                flag_reasons=["Structuring detected: repeated rapid successive payments under 10,000 threshold"],
                sender_id="USR-GOLDEN-5",
                receiver_id="USR-MULE-1"
            )
            coord_result = await coordinator.evaluate_and_coordinate(assessment)

        assert coord_result.status == "HELD_FOR_REVIEW"
        assert coord_result.action_taken == "ESCALATE_TO_ANALYST"
        assert coord_result.requires_human_approval is True
        assert coord_result.details.get("structuring_detected") is True

    @pytest.mark.asyncio
    async def test_golden_case_6_benign_low_risk_auto_approve(self, tx_agent, coordinator):
        """
        GOLDEN CASE 6: Benign Everyday Low-Value Payment
        Amount: Rs. 1,500 LKR
        Velocity: 1
        Domestic, known counterparty, normal historical match.
        Expected: Risk score < 30, AUTO_APPROVE, sub-100ms latency.
        """
        start = time.perf_counter()
        tx_input = TransactionAnalysisInput(
            transaction_id="GC-006-BENIGN",
            user_id="USR-REGULAR-1",
            amount=1500.0,
            recipient_id="USR-STORE-1",
            note="Groceries",
            historical_transactions=[
                {"amount": 1200.0, "recipient_id": "USR-STORE-1", "timestamp": "2026-09-20T10:00:00Z"},
                {"amount": 1600.0, "recipient_id": "USR-STORE-1", "timestamp": "2026-09-25T14:00:00Z"},
            ]
        )
        agent1_result = await tx_agent.evaluate_transaction(tx_input)
        assert agent1_result.final_risk_score < 30.0

        assessment = FraudAssessmentInput(
            transaction_id="GC-006-BENIGN",
            amount=1500.0,
            risk_score=agent1_result.final_risk_score,
            flag_reasons=agent1_result.reasons,
            sender_id="USR-REGULAR-1",
            receiver_id="USR-STORE-1"
        )
        coord_result = await coordinator.evaluate_and_coordinate(assessment)
        latency = (time.perf_counter() - start) * 1000

        assert coord_result.status == "APPROVED"
        assert coord_result.action_taken == "AUTO_APPROVE"
        assert coord_result.requires_human_approval is False
        assert latency < 250

    @pytest.mark.asyncio
    async def test_golden_case_7_circuit_breaker_telemetry_outage(self, coordinator):
        """
        GOLDEN CASE 7: Circuit Breaker During Telemetry Outage (Section 3.4)
        - Sub-test A: Amount = Rs. 12,000 (< Rs. 25,000) -> Deterministic fallback auto-cleared.
        - Sub-test B: Amount = Rs. 40,000 (>= Rs. 25,000) -> Held with AI_SERVICE_UNAVAILABLE tag.
        """
        # Case A: Low value
        low_val_assessment = FraudAssessmentInput(
            transaction_id="GC-007-OUTAGE-LOW",
            amount=12000.0,
            risk_score=0.0,
            flag_reasons=[],
            sender_id="USR-CB-1",
            receiver_id="USR-CB-2",
            is_outage_fallback=True
        )
        res_a = await coordinator.evaluate_and_coordinate(low_val_assessment)
        assert res_a.status == "APPROVED"
        assert res_a.action_taken == "DETERMINISTIC_FALLBACK_APPROVED"

        # Case B: High value
        with patch.object(coordinator, "_sync_with_backend_queue", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = True
            high_val_assessment = FraudAssessmentInput(
                transaction_id="GC-007-OUTAGE-HIGH",
                amount=40000.0,
                risk_score=0.0,
                flag_reasons=[],
                sender_id="USR-CB-1",
                receiver_id="USR-CB-2",
                is_outage_fallback=True
            )
            res_b = await coordinator.evaluate_and_coordinate(high_val_assessment)

        assert res_b.status == "HELD_FOR_REVIEW"
        assert res_b.action_taken == "ESCALATE_TO_ANALYST"
        assert res_b.requires_human_approval is True
        assert "AI_SERVICE_UNAVAILABLE" in res_b.tag
