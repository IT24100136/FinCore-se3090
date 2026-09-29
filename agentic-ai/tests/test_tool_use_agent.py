import pytest
import respx
from httpx import Response
from fastapi.testclient import TestClient

from agents.tool_use_agent import (
    ToolUseAgent,
    send_notification_tool,
    NotificationRequestInput,
    tool_use_agent_node,
    format_customer_message,
    infer_notification_type
)
from main import app

TEST_API_URL = "http://localhost:5007/api/notifications/send"


@pytest.mark.asyncio
@respx.mock
async def test_successful_dispatch():
    """
    Test 1: Successful dispatch on attempt 1 (200 OK).
    """
    route = respx.post(TEST_API_URL).mock(
        return_value=Response(
            200,
            json={
                "id": 101,
                "userId": 1,
                "recipient": "+94771234567",
                "recipientName": "Customer Name",
                "type": "SMS",
                "message": "Security Alert: Your transfer of LKR 75,000 has been held for review.",
                "deliveryStatus": "Sent",
                "channelDetails": "Twilio/Brevo Gateway",
                "latencyMs": 150,
                "timestamp": "2026-09-29T15:00:00Z"
            }
        )
    )

    agent = ToolUseAgent(api_url=TEST_API_URL, max_retries=3, backoff_delays=[0.01, 0.02, 0.04])
    payload = {
        "transaction_id": "TX-998811",
        "user_id": 1,
        "recipient_contact": "+94771234567",
        "recipient_name": "Customer Name",
        "decision": "HELD",
        "amount": 75000.0,
        "currency": "LKR"
    }

    result = await agent.process_decision(payload)

    assert route.called
    assert route.call_count == 1
    assert result["status"] == "SENT"
    assert result["notification_telemetry"]["status"] == "SENT"
    assert result["notification_telemetry"]["attempts"] == 1
    assert result["notification_telemetry"]["channel"] == "SMS"
    assert result["notification_telemetry"]["error"] is None
    assert "Security Alert: Your transfer of LKR 75,000 has been held for review." in result["message_sent"]


@pytest.mark.asyncio
@respx.mock
async def test_transient_failure_successful_retry():
    """
    Test 2: Transient failure (500 Internal Server Error) on attempt 1,
    succeeds on attempt 2 (200 OK).
    """
    route = respx.post(TEST_API_URL).mock(
        side_effect=[
            Response(500, json={"error": "Gateway Timeout"}),
            Response(200, json={"id": 102, "deliveryStatus": "Sent"})
        ]
    )

    agent = ToolUseAgent(api_url=TEST_API_URL, max_retries=3, backoff_delays=[0.01, 0.02, 0.04])
    payload = {
        "transaction_id": "TX-998812",
        "user_id": 1,
        "recipient_contact": "+94771234567",
        "decision": "APPROVED",
        "amount": 50000.0
    }

    result = await agent.process_decision(payload)

    assert route.called
    assert route.call_count == 2
    assert result["status"] == "SENT"
    assert result["notification_telemetry"]["status"] == "SENT"
    assert result["notification_telemetry"]["attempts"] == 2
    assert result["notification_telemetry"]["error"] is None


@pytest.mark.asyncio
@respx.mock
async def test_permanent_failure_exhausted_retries():
    """
    Test 3: Permanent failure across all 3 attempts (503 Service Unavailable).
    Returns status "FAILED" without raising uncaught exceptions.
    """
    route = respx.post(TEST_API_URL).mock(
        return_value=Response(503, json={"error": "Service Unavailable"})
    )

    agent = ToolUseAgent(api_url=TEST_API_URL, max_retries=3, backoff_delays=[0.01, 0.02, 0.04])
    payload = {
        "transaction_id": "TX-998813",
        "user_id": 1,
        "recipient_contact": "+94771234567",
        "decision": "REJECTED",
        "amount": 120000.0,
        "reason": "High fraud probability"
    }

    result = await agent.process_decision(payload)

    assert route.called
    assert route.call_count == 3
    assert result["status"] == "FAILED"
    assert result["notification_telemetry"]["status"] == "FAILED"
    assert result["notification_telemetry"]["attempts"] == 3
    assert result["notification_telemetry"]["error"] is not None
    assert "HTTP 503" in result["notification_telemetry"]["error"]


@pytest.mark.asyncio
@respx.mock
async def test_langgraph_node_execution():
    """
    Test 4: LangGraph node function tool_use_agent_node.
    """
    respx.post(TEST_API_URL).mock(return_value=Response(200, json={"status": "OK"}))

    state = {
        "transaction_id": "TX-777",
        "decision_payload": {
            "transaction_id": "TX-777",
            "decision": "HELD",
            "amount": 75000.0
        }
    }

    new_state = await tool_use_agent_node(state)

    assert "notification_result" in new_state
    assert new_state["notification_result"]["status"] in ("SENT", "FAILED")
    assert new_state["action_summary"]["agent"] == "ToolUseAgent"


def test_channel_type_inference():
    assert infer_notification_type("+94771234567") == "SMS"
    assert infer_notification_type("customer@fincore.com") == "Email"


def test_message_formatting():
    msg_held = format_customer_message("HELD", amount=75000)
    assert msg_held == "Security Alert: Your transfer of LKR 75,000 has been held for review."

    msg_approved = format_customer_message("APPROVED", amount=50000)
    assert msg_approved == "Security Alert: Your transfer of LKR 50,000 has been approved and settled successfully."

    msg_rejected = format_customer_message("REJECTED", amount=100000, reason="Structuring detected")
    assert msg_rejected == "Security Alert: Your transfer of LKR 100,000 has been rejected following security inspection. Reason: Structuring detected"


@respx.mock
def test_notify_endpoint():
    """
    Test FastAPI POST /agent/tools/notify endpoint.
    """
    respx.post(TEST_API_URL).mock(return_value=Response(200, json={"status": "OK"}))
    test_client = TestClient(app)

    response = test_client.post("/agent/tools/notify", json={
        "transaction_id": "TX-API-001",
        "user_id": 1,
        "recipient_contact": "+94771234567",
        "decision": "HELD",
        "amount": 75000.0
    })

    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "TX-API-001"
    assert data["status"] in ("SENT", "FAILED")
