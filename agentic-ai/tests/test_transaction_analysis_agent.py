import pytest
from agents.transaction_analysis_agent import (
    TransactionAnalysisAgent,
    TransactionAnalysisInput
)


@pytest.mark.asyncio
async def test_normal_transaction_stays_on_30d_window():
    agent = TransactionAnalysisAgent()

    # User with regular 30-day history with this recipient
    history = [
        {"amount": 10000.0, "recipient_id": "merchant_1", "window_days": 10},
        {"amount": 12000.0, "recipient_id": "merchant_1", "window_days": 20},
    ]

    inp = TransactionAnalysisInput(
        transaction_id="TX-NORM-01",
        user_id="user_123",
        amount=11000.0,
        recipient_id="merchant_1",
        note="Grocery items",
        historical_transactions=history
    )

    result = await agent.evaluate_transaction(inp)

    assert result.window_expanded is False
    assert result.history_window_days == 30
    assert result.final_risk_score < 35.0
    assert result.status == "LOW_RISK"
    assert result.is_recipient_novel is False


@pytest.mark.asyncio
async def test_borderline_triggers_90d_window_expansion():
    agent = TransactionAnalysisAgent()

    # In 30-day window, recipient_novelty triggers +30, moderate amount deviation triggers +15 -> initial score = 45 (Borderline!)
    # In 90-day window, recipient was previously paid 60 days ago -> novelty penalty clears!
    history = [
        {"amount": 8000.0, "recipient_id": "other_vendor", "window_days": 15},
        {"amount": 7500.0, "recipient_id": "other_vendor", "window_days": 25},
        # Prior transaction with this recipient 65 days ago (outside 30d, inside 90d):
        {"amount": 18000.0, "recipient_id": "quarterly_vendor", "window_days": 65}
    ]

    inp = TransactionAnalysisInput(
        transaction_id="TX-BORDER-01",
        user_id="user_456",
        amount=20000.0,
        recipient_id="quarterly_vendor",
        note="Quarterly payment",
        historical_transactions=history
    )

    result = await agent.evaluate_transaction(inp)

    # Verify that the adaptive window expanded to 90 days!
    assert result.window_expanded is True
    assert result.history_window_days == 90
    assert "in borderline band" in (result.window_expansion_reason or "")
    # In 90-day window, quarterly_vendor is found -> novelty is cleared!
    assert result.is_recipient_novel is False
    assert result.final_risk_score <= result.initial_risk_score


@pytest.mark.asyncio
async def test_high_risk_transaction_flagged():
    agent = TransactionAnalysisAgent()

    history = [
        {"amount": 2000.0, "recipient_id": "known_contact", "window_days": 10},
    ]

    # Extreme amount deviation (150,000 vs 2,000 baseline) + novel recipient + crypto keyword
    inp = TransactionAnalysisInput(
        transaction_id="TX-HIGH-01",
        user_id="user_789",
        amount=150000.0,
        recipient_id="unknown_crypto_wallet",
        note="Urgent crypto transfer",
        historical_transactions=history
    )

    result = await agent.evaluate_transaction(inp)

    assert result.final_risk_score >= 70.0
    assert result.status == "HIGH_RISK"
    assert result.is_recipient_novel is True
