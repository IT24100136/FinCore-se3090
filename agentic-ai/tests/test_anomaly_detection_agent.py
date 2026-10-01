"""
Tests for FinCore Agent 2 - Anomaly Detection Agent (LangGraph)
==============================================================
Validates behavioral signal evaluation, deep context retrieval routing,
final scoring calibration, and downstream SHAP compatibility.
"""

from agents.anomaly_detection_agent import (
    invoke_anomaly_agent,
    build_anomaly_detection_graph,
    SHAP_FEATURE_HIGH_AMOUNT,
    SHAP_FEATURE_HIGH_VELOCITY,
    SHAP_FEATURE_LOCATION_ANOMALY
)
import shap_service



def test_graph_compilation():
    """Verify that the LangGraph StateGraph compiles cleanly without errors."""
    app = build_anomaly_detection_graph()
    assert app is not None


def test_benign_transaction():
    """
    Test 1: Clean, routine everyday transaction.
    Verifies that Node 1 determines needs_deep_context=False,
    Node 2 is bypassed, and the final anomaly score is low.
    """
    payload = {
        "transaction_id": "TX-TEST-BENIGN",
        "user_id": "USR-1001",
        "amount": 150.0,
        "device_id": "device_iphone_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 1
    }

    result = invoke_anomaly_agent(payload)

    assert result["needs_deep_context"] is False
    assert result["is_anomaly"] is False
    assert result["anomaly_score"] < 0.50
    assert result["primary_shap_feature"] == ""
    assert len(result["flagged_signals"]) == 0


def test_spending_spike_anomaly():
    """
    Test 2: Extreme spending spike ($25,000 > $10,000 baseline).
    Verifies deep context is engaged, historical deviation is flagged,
    and primary_shap_feature is set to 'high_amount'.
    """
    payload = {
        "transaction_id": "TX-TEST-AMOUNT",
        "user_id": "USR-2002",
        "amount": 25000.0,
        "device_id": "device_iphone_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 1
    }

    result = invoke_anomaly_agent(payload)

    assert result["needs_deep_context"] is True
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] >= 0.50
    assert result["primary_shap_feature"] == SHAP_FEATURE_HIGH_AMOUNT
    assert any("SPENDING_SPIKE" in sig for sig in result["flagged_signals"])
    assert any("HISTORICAL_SPENDING_DEVIATION" in sig for sig in result["flagged_signals"])


def test_velocity_burst_anomaly():
    """
    Test 3: High transaction frequency (6 transactions in 24h).
    Verifies 7-day velocity telemetry tool is engaged, burst is confirmed,
    and primary_shap_feature is set to 'high_velocity'.
    """
    payload = {
        "transaction_id": "TX-TEST-VELOCITY",
        "user_id": "USR-3003",
        "amount": 750.0,
        "device_id": "device_pixel_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 6
    }

    result = invoke_anomaly_agent(payload)

    assert result["needs_deep_context"] is True
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] >= 0.50
    assert result["primary_shap_feature"] == SHAP_FEATURE_HIGH_VELOCITY
    assert any("HIGH_VELOCITY" in sig for sig in result["flagged_signals"])
    assert any("EXTENDED_VELOCITY_SURGE" in sig for sig in result["flagged_signals"])


def test_location_and_device_anomaly():
    """
    Test 4: Suspicious untrusted emulator device with foreign VPN connection.
    Verifies deep hardware telemetry flags emulator risk, and
    primary_shap_feature is set to 'location_anomaly'.
    """
    payload = {
        "transaction_id": "TX-TEST-LOCATION",
        "user_id": "USR-4004",
        "amount": 2500.0,
        "device_id": "dev_new_emulator_android_x86",
        "ip_location": "Commercial Datacenter VPN, Lagos",
        "velocity_24h": 1
    }

    result = invoke_anomaly_agent(payload)

    assert result["needs_deep_context"] is True
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] >= 0.50
    assert result["primary_shap_feature"] == SHAP_FEATURE_LOCATION_ANOMALY
    assert any("NEW_DEVICE" in sig for sig in result["flagged_signals"])
    assert any("LOCATION_MISMATCH" in sig for sig in result["flagged_signals"])
    assert any("DEEP_DEVICE_RISK" in sig for sig in result["flagged_signals"])


def test_shap_service_compatibility():
    """
    Test 5: Ensure all produced SHAP feature keys strictly match
    shap_service.py STANDARDIZED_REASONS.
    """
    valid_reasons = set(shap_service.STANDARDIZED_REASONS.values())

    assert SHAP_FEATURE_HIGH_AMOUNT in valid_reasons
    assert SHAP_FEATURE_HIGH_VELOCITY in valid_reasons
    assert SHAP_FEATURE_LOCATION_ANOMALY in valid_reasons
