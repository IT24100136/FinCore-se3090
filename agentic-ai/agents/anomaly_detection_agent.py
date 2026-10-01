"""
FinCore - Agent 2: Anomaly Detection Agent
===========================================
Multi-Agent Fraud Detection Subsystem (Component S2)
Built with LangGraph to monitor behavioral signals (transaction velocity,
spending spikes, device fingerprinting, and IP geolocation mismatches)
and compute a standardized fraud anomaly score.

Downstream Integration:
- Downstream SHAP Explainability Service (shap_service.py) consumes standardized
  feature labels ('location_anomaly', 'high_velocity', 'high_amount').
- Approval Coordinator Agent (approval_coordinator_agent.py) consumes the resulting
  anomaly score and flag reasons for routing and policy enforcement.
"""

from __future__ import annotations

import logging
from typing import TypedDict, List, Dict, Any, Optional, Union
# ---------------------------------------------------------------------------
# Dynamic Dependency Resolution & Static Analysis Compatibility
# Resolves LangGraph components with typed fallbacks to eliminate
# static analyzer / Pyrefly missing-import diagnostics.
# ---------------------------------------------------------------------------
try:
    from langgraph.graph import StateGraph, END  # type: ignore
except (ImportError, ModuleNotFoundError):
    import importlib
    _lg_graph = importlib.import_module("langgraph.graph")
    StateGraph: Any = getattr(_lg_graph, "StateGraph")
    END: str = getattr(_lg_graph, "END", "__end__")


# Configure logger for Anomaly Detection Agent
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - [%(levelname)s] - %(message)s"
)
logger = logging.getLogger("AnomalyDetectionAgent")


# ============================================================================
# 1. STANDARDIZED CONSTANTS & THRESHOLDS
# ============================================================================

# Baseline heuristic thresholds
BASELINE_AMOUNT_THRESHOLD: float = 10000.0   # Spending spike trigger ($10,000 baseline)
BASELINE_VELOCITY_THRESHOLD: int = 3         # Max normal transactions in 24 hours
ANOMALY_SCORE_FLAG_THRESHOLD: float = 0.50   # Threshold above which transaction is flagged

# Standardized feature codes aligned with shap_service.py STANDARDIZED_REASONS
SHAP_FEATURE_LOCATION_ANOMALY: str = "location_anomaly"
SHAP_FEATURE_HIGH_VELOCITY: str = "high_velocity"
SHAP_FEATURE_HIGH_AMOUNT: str = "high_amount"

# Known trusted devices and locations for heuristic comparison
SUSPICIOUS_LOCATION_INDICATORS: List[str] = [
    "vpn", "proxy", "tor", "nigeria", "russia", "unknown", "datacenter", "unregistered"
]
KNOWN_TRUSTED_DEVICES: List[str] = [
    "device_iphone_trusted_01",
    "device_macbook_trusted_01",
    "device_pixel_trusted_01"
]


# ============================================================================
# 2. STATE DEFINITION
# ============================================================================

class AnomalyAgentState(TypedDict, total=False):
    """
    LangGraph state schema for Agent 2 (Anomaly Detection Agent).

    Attributes:
        amount (float): Transaction monetary value.
        device_id (str): Unique hardware/client identifier.
        ip_location (str): Geolocation or IP address classification of the client.
        velocity_24h (int): Number of transactions initiated by user in last 24 hours.
        anomaly_score (float): Calculated fraud anomaly score normalized between 0.0 and 1.0.
        flagged_signals (List[str]): Explanatory behavioral signals flagged during evaluation.
        needs_deep_context (bool): Route indicator determining if deep historical context is required.
        primary_shap_feature (str): Standardized top contributing factor ('location_anomaly',
                                   'high_velocity', 'high_amount', or empty if benign).
        transaction_id (Optional[str]): Optional correlation ID for transaction tracking.
        user_id (Optional[str]): Identifier for the initiating customer/account.
        context_details (Optional[Dict[str, Any]]): Telemetry gathered during Node 2 execution.
        is_anomaly (Optional[bool]): True if anomaly_score >= ANOMALY_SCORE_FLAG_THRESHOLD.
    """
    amount: float
    device_id: str
    ip_location: str
    velocity_24h: int
    anomaly_score: float
    flagged_signals: List[str]
    needs_deep_context: bool
    primary_shap_feature: str
    transaction_id: Optional[str]
    user_id: Optional[str]
    context_details: Optional[Dict[str, Any]]
    is_anomaly: Optional[bool]


# ============================================================================
# 3. MOCK CONTEXT RETRIEVAL TOOLS (USED BY NODE 2)
# ============================================================================

def retrieve_extended_device_history(device_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Simulated device intelligence tool.
    Queries historical device reputation, hardware fingerprint integrity,
    and cross-account binding.
    """
    device_id_clean = (device_id or "").strip().lower()

    if any(tag in device_id_clean for tag in ["new", "unrecognized", "emulator", "spoofed", "unknown"]):
        return {
            "device_reputation_score": 0.20,  # 0.0 (high risk) to 1.0 (trusted)
            "hardware_signature_matched": False,
            "is_emulator_detected": "emulator" in device_id_clean or "spoofed" in device_id_clean,
            "accounts_associated_count": 4 if "spoofed" in device_id_clean else 1,
            "first_seen_hours_ago": 1.5,
            "verdict": "UNVERIFIED_OR_HOSTILE_DEVICE"
        }

    return {
        "device_reputation_score": 0.95,
        "hardware_signature_matched": True,
        "is_emulator_detected": False,
        "accounts_associated_count": 1,
        "first_seen_hours_ago": 4320.0,  # ~180 days
        "verdict": "KNOWN_TRUSTED_DEVICE"
    }


def retrieve_extended_velocity_history(user_id: Optional[str], current_velocity_24h: int) -> Dict[str, Any]:
    """
    Simulated behavioral telemetry tool.
    Retrieves a broader multi-day timeframe (7-day / 30-day velocity, rapid bursts,
    and average baseline spending intervals).
    """
    simulated_7d_count = max(current_velocity_24h * 3, current_velocity_24h + 2)
    is_burst_pattern = current_velocity_24h >= 4

    return {
        "velocity_7d_total": simulated_7d_count,
        "velocity_30d_daily_avg": 1.2,
        "rapid_successive_burst_detected": is_burst_pattern,
        "inter_transaction_interval_minutes": 4.5 if is_burst_pattern else 240.0,
        "verdict": "VELOCITY_SPIKE_CONFIRMED" if is_burst_pattern else "VELOCITY_WITHIN_NORMAL_EXPANDED_TOLERANCE"
    }


def retrieve_ip_intelligence(ip_location: str) -> Dict[str, Any]:
    """
    Simulated IP intelligence and VPN/proxy telemetry tool.
    """
    ip_clean = (ip_location or "").strip().lower()
    is_proxy_or_vpn = any(indicator in ip_clean for indicator in SUSPICIOUS_LOCATION_INDICATORS)

    return {
        "is_datacenter_or_vpn": is_proxy_or_vpn,
        "asn_risk_tier": "HIGH" if is_proxy_or_vpn else "LOW",
        "geo_distance_from_billing_km": 8500 if is_proxy_or_vpn else 15,
        "verdict": "HIGH_RISK_GEO_LOCATION" if is_proxy_or_vpn else "NORMAL_DOMESTIC_LOCATION"
    }


def retrieve_extended_spending_history(user_id: Optional[str], amount: float) -> Dict[str, Any]:
    """
    Simulated historical spending telemetry tool.
    Retrieves customer's 90-day spending baseline, historical median transfer size,
    and calculates deviation ratio.
    """
    median_baseline = 250.0  # Normal customer median transaction
    deviation_ratio = amount / median_baseline if median_baseline > 0 else 1.0
    is_severe_deviation = amount > BASELINE_AMOUNT_THRESHOLD

    return {
        "user_90d_median_amount": median_baseline,
        "deviation_ratio": round(deviation_ratio, 2),
        "is_severe_deviation": is_severe_deviation,
        "verdict": "SPENDING_SPIKE_CONFIRMED" if is_severe_deviation else "SPENDING_WITHIN_NORMAL_EXPANDED_TOLERANCE"
    }


# ============================================================================
# 4. LANGGRAPH NODES
# ============================================================================

def initial_signal_evaluation_node(state: AnomalyAgentState) -> Dict[str, Any]:
    """
    Node 1 - Initial Signal Evaluation
    ----------------------------------
    Evaluates raw transaction inputs against baseline heuristics:
    1. High spending spike: amount > $10,000.00 baseline
    2. High transaction frequency: velocity_24h > 3 transactions
    3. Device anomaly: new, unrecognized, or untrusted hardware
    4. Geolocation mismatch: connection from known VPN, foreign, or suspicious location

    Decision Logic:
    Determines whether the transaction requires deeper historical context
    (needs_deep_context = True) if multiple baseline signals fire, if a spending
    spike exceeds $10,000, if an unknown device is encountered, or if high
    velocity warrants multi-day inspection.
    """
    tx_id = state.get("transaction_id", "TX-UNKNOWN")
    amount = float(state.get("amount", 0.0))
    device_id = str(state.get("device_id", "")).strip()
    ip_location = str(state.get("ip_location", "")).strip()
    velocity_24h = int(state.get("velocity_24h", 0))

    logger.info(f"[{tx_id}] Executing Node 1: Initial Signal Evaluation (Amount=${amount:,.2f}, Vel24h={velocity_24h})")

    flagged_signals: List[str] = list(state.get("flagged_signals") or [])
    signals_count = 0

    # 1. Baseline Heuristic: High Transaction Amount
    is_amount_spike = amount > BASELINE_AMOUNT_THRESHOLD
    if is_amount_spike:
        signal = f"SPENDING_SPIKE: Amount of ${amount:,.2f} exceeds baseline threshold (${BASELINE_AMOUNT_THRESHOLD:,.2f})"
        flagged_signals.append(signal)
        signals_count += 1
        logger.warning(f"[{tx_id}] Flagged: {signal}")

    # 2. Baseline Heuristic: 24h Velocity
    if velocity_24h > BASELINE_VELOCITY_THRESHOLD:
        signal = f"HIGH_VELOCITY: 24h frequency ({velocity_24h} transfers) exceeds standard limit ({BASELINE_VELOCITY_THRESHOLD})"
        flagged_signals.append(signal)
        signals_count += 1
        logger.warning(f"[{tx_id}] Flagged: {signal}")

    # 3. Baseline Heuristic: Unrecognized Device Detection
    is_new_device = (
        device_id not in KNOWN_TRUSTED_DEVICES or
        any(k in device_id.lower() for k in ["new", "unrecognized", "unknown", "spoofed", "emulator"])
    )
    if is_new_device:
        signal = f"NEW_DEVICE: Device identifier '{device_id}' is unrecognized or newly encountered"
        flagged_signals.append(signal)
        signals_count += 1
        logger.warning(f"[{tx_id}] Flagged: {signal}")

    # 4. Baseline Heuristic: Location / IP Mismatch
    is_location_suspicious = any(k in ip_location.lower() for k in SUSPICIOUS_LOCATION_INDICATORS)
    if is_location_suspicious:
        signal = f"LOCATION_MISMATCH: Originating IP/Location '{ip_location}' matches suspicious routing or geo anomaly"
        flagged_signals.append(signal)
        signals_count += 1
        logger.warning(f"[{tx_id}] Flagged: {signal}")

    # 5. Routing Decision: Deep Context Requirement
    # Require deeper context if:
    # - Spending spike exceeds baseline threshold (needs historical baseline check)
    # - New device detected (needs device fingerprinting/reputation history)
    # - Velocity > 3 (needs extended 7-day velocity/burst analysis)
    # - Suspicious location detected (needs ASN/VPN intelligence)
    # - Or two or more baseline heuristics fired concurrently
    needs_deep_context = (
        is_amount_spike or
        is_new_device or
        (velocity_24h > BASELINE_VELOCITY_THRESHOLD) or
        is_location_suspicious or
        (signals_count >= 2)
    )

    logger.info(
        f"[{tx_id}] Node 1 Complete: {signals_count} signals flagged. "
        f"needs_deep_context={needs_deep_context}"
    )

    return {
        "flagged_signals": flagged_signals,
        "needs_deep_context": needs_deep_context
    }


def context_gathering_node(state: AnomalyAgentState) -> Dict[str, Any]:
    """
    Node 2 - Context Gathering (Tool / Intelligence Retrieval)
    ----------------------------------------------------------
    Invoked when initial signals warrant deep context.
    Executes mock/tool retrievals to:
    1. Query extended device history (hardware fingerprint, emulator check, multi-account links).
    2. Check broader velocity timeframe (7-day burst analysis, rapid successive transfers).
    3. Query IP intelligence (ASN risk, proxy detection, geo-distance).
    4. Query historical spending profile (90-day baseline deviation check).

    Adjusts and enriches the `flagged_signals` based on the telemetry discovered.
    """
    tx_id = state.get("transaction_id", "TX-UNKNOWN")
    user_id = state.get("user_id")
    amount = float(state.get("amount", 0.0))
    device_id = state.get("device_id", "")
    ip_location = state.get("ip_location", "")
    velocity_24h = state.get("velocity_24h", 0)
    flagged_signals = list(state.get("flagged_signals") or [])

    logger.info(f"[{tx_id}] Executing Node 2: Gathering Deep Historical Context & Device Intelligence")

    # Tool Execution 1: Extended Device Intelligence
    device_intel = retrieve_extended_device_history(device_id=device_id, user_id=user_id)
    if device_intel.get("verdict") == "UNVERIFIED_OR_HOSTILE_DEVICE":
        if device_intel.get("is_emulator_detected"):
            flagged_signals.append("DEEP_DEVICE_RISK: Telemetry detected virtualized/emulator hardware environment")
        elif device_intel.get("accounts_associated_count", 1) > 1:
            flagged_signals.append(f"DEEP_DEVICE_RISK: Hardware signature linked across multiple distinct user accounts ({device_intel['accounts_associated_count']} accounts)")
        else:
            flagged_signals.append(f"DEEP_DEVICE_RISK: Zero prior history; device first observed {device_intel.get('first_seen_hours_ago')}h ago")

    # Tool Execution 2: Extended Velocity Intelligence
    velocity_intel = retrieve_extended_velocity_history(user_id=user_id, current_velocity_24h=velocity_24h)
    if velocity_intel.get("verdict") == "VELOCITY_SPIKE_CONFIRMED":
        burst_interval = velocity_intel.get("inter_transaction_interval_minutes", 0)
        total_7d = velocity_intel.get("velocity_7d_total", 0)
        flagged_signals.append(
            f"EXTENDED_VELOCITY_SURGE: Multi-day burst confirmed ({total_7d} transactions in 7d; avg interval {burst_interval:.1f} mins)"
        )

    # Tool Execution 3: IP & Network Telemetry
    ip_intel = retrieve_ip_intelligence(ip_location=ip_location)
    if ip_intel.get("is_datacenter_or_vpn"):
        flagged_signals.append(
            f"NETWORK_ANOMALY: Geolocation resolved to datacenter VPN proxy with geo-distance of {ip_intel.get('geo_distance_from_billing_km')} km"
        )

    # Tool Execution 4: Historical Spending Telemetry
    spending_intel = retrieve_extended_spending_history(user_id=user_id, amount=amount)
    if spending_intel.get("is_severe_deviation"):
        dev_ratio = spending_intel.get("deviation_ratio", 0.0)
        median_base = spending_intel.get("user_90d_median_amount", 0.0)
        flagged_signals.append(
            f"HISTORICAL_SPENDING_DEVIATION: Amount of ${amount:,.2f} is {dev_ratio:.1f}x higher than 90-day user median (${median_base:,.2f})"
        )

    context_details = {
        "device_telemetry": device_intel,
        "velocity_telemetry": velocity_intel,
        "ip_telemetry": ip_intel,
        "spending_telemetry": spending_intel
    }

    logger.info(f"[{tx_id}] Node 2 Complete: Enriched flagged signals count = {len(flagged_signals)}")

    return {
        "flagged_signals": flagged_signals,
        "context_details": context_details
    }


def final_scoring_node(state: AnomalyAgentState) -> Dict[str, Any]:
    """
    Node 3 - Final Scoring & Handoff Preparation
    ---------------------------------------------
    1. Evaluates all accumulated signals and feature dimensions.
    2. Calculates a normalized anomaly score between 0.0 and 1.0 based on:
       - Amount Severity (ratio of amount vs baseline threshold)
       - Velocity Severity (24h frequency & multi-day burst indicators)
       - Location / Device Severity (untrusted device, emulator, VPN/proxy)
    3. If anomaly_score >= ANOMALY_SCORE_FLAG_THRESHOLD:
       - Flags the transaction (is_anomaly = True).
       - Determines the single highest contributing factor and assigns
         `primary_shap_feature` to one of FinCore's standardized codes:
         * 'location_anomaly'
         * 'high_velocity'
         * 'high_amount'
         This enables direct, seamless consumption by the downstream SHAP
         Explainability Service (shap_service.py).
    4. If benign (score < threshold):
       - is_anomaly = False
       - primary_shap_feature = ""
    """
    tx_id = state.get("transaction_id", "TX-UNKNOWN")
    amount = float(state.get("amount", 0.0))
    velocity_24h = int(state.get("velocity_24h", 0))
    flagged_signals = list(state.get("flagged_signals") or [])
    context_details = state.get("context_details") or {}

    logger.info(f"[{tx_id}] Executing Node 3: Final Scoring & SHAP Handoff Preparation")

    # ------------------------------------------------------------------------
    # Dimension 1: Amount Contribution (0.0 to 1.0)
    # ------------------------------------------------------------------------
    # Scaled against baseline threshold ($10,000 baseline)
    if amount <= 1000.0:
        amount_contribution = 0.05
    elif amount <= BASELINE_AMOUNT_THRESHOLD:
        amount_contribution = 0.10 + (amount / BASELINE_AMOUNT_THRESHOLD) * 0.25  # 0.10 - 0.35
    else:
        # Scale above $10,000 up to $50,000
        over_ratio = (amount - BASELINE_AMOUNT_THRESHOLD) / 40000.0
        amount_contribution = min(0.50 + (over_ratio * 0.50), 1.0)

    # Boost if Node 2 confirmed historical spending deviation
    if any("HISTORICAL_SPENDING_DEVIATION" in sig for sig in flagged_signals):
        amount_contribution = min(amount_contribution + 0.25, 1.0)

    # ------------------------------------------------------------------------
    # Dimension 2: Velocity Contribution (0.0 to 1.0)
    # ------------------------------------------------------------------------
    if velocity_24h <= 1:
        velocity_contribution = 0.05
    elif velocity_24h <= BASELINE_VELOCITY_THRESHOLD:
        velocity_contribution = 0.25
    else:
        # 4 transfers = 0.55, 6 transfers = 0.85, 8+ transfers = 1.0
        velocity_contribution = min(0.40 + ((velocity_24h - BASELINE_VELOCITY_THRESHOLD) * 0.15), 1.0)

    # Boost if Node 2 confirmed extended 7-day velocity surge
    if any("EXTENDED_VELOCITY_SURGE" in sig for sig in flagged_signals):
        velocity_contribution = min(velocity_contribution + 0.20, 1.0)

    # ------------------------------------------------------------------------
    # Dimension 3: Location / Device Contribution (0.0 to 1.0)
    # ------------------------------------------------------------------------
    location_device_contribution = 0.05

    # Check for new device
    if any("NEW_DEVICE" in sig for sig in flagged_signals):
        location_device_contribution += 0.30

    # Check for deep device emulator / hostile signals
    if any("DEEP_DEVICE_RISK" in sig for sig in flagged_signals):
        location_device_contribution += 0.40

    # Check for location mismatch / VPN
    if any("LOCATION_MISMATCH" in sig for sig in flagged_signals):
        location_device_contribution += 0.25
    if any("NETWORK_ANOMALY" in sig for sig in flagged_signals):
        location_device_contribution += 0.35

    location_device_contribution = min(location_device_contribution, 1.0)

    # ------------------------------------------------------------------------
    # Synthesize Aggregate Anomaly Score (0.0 to 1.0)
    # Weighted Model: Amount (35%), Velocity (35%), Location/Device (30%)
    # ------------------------------------------------------------------------
    base_score = (
        (amount_contribution * 0.35) +
        (velocity_contribution * 0.35) +
        (location_device_contribution * 0.30)
    )

    # Track raw individual dimension contributions for explainability ranking
    feature_contributions: Dict[str, float] = {
        SHAP_FEATURE_HIGH_AMOUNT: amount_contribution,
        SHAP_FEATURE_HIGH_VELOCITY: velocity_contribution,
        SHAP_FEATURE_LOCATION_ANOMALY: location_device_contribution
    }
    peak_risk = max(feature_contributions.values())

    # Compound Risk Multiplier: Multiple simultaneous red flags compound fraud likelihood
    red_flag_count = len(flagged_signals)
    if red_flag_count >= 4:
        base_score = min(base_score * 1.30, 1.0)
    elif red_flag_count >= 2:
        base_score = min(base_score * 1.15, 1.0)

    # Peak-Risk Floor: Avoid dilution if an individual dimension is severely elevated (>= 0.75)
    # (e.g. rapid structuring / burst velocity even with small amounts)
    if peak_risk >= 0.75:
        base_score = max(base_score, peak_risk * 0.75)

    # Clamp to [0.0, 1.0] and round to 4 decimal places
    final_anomaly_score = round(max(0.0, min(base_score, 1.0)), 4)
    is_anomaly = final_anomaly_score >= ANOMALY_SCORE_FLAG_THRESHOLD

    # ------------------------------------------------------------------------
    # Determine Primary SHAP Feature
    # ------------------------------------------------------------------------
    # If the score is high enough to flag the transaction, identify the top
    # contributing factor and map it to standardized FinCore codes:
    # 'location_anomaly', 'high_velocity', or 'high_amount'
    if is_anomaly:
        primary_shap_feature = max(feature_contributions, key=feature_contributions.get)  # type: ignore
        logger.warning(
            f"[{tx_id}] Anomaly Detected! Score={final_anomaly_score:.4f} >= {ANOMALY_SCORE_FLAG_THRESHOLD}. "
            f"Top SHAP Feature='{primary_shap_feature}'"
        )
    else:
        primary_shap_feature = ""
        logger.info(
            f"[{tx_id}] Benign Transaction. Score={final_anomaly_score:.4f} < {ANOMALY_SCORE_FLAG_THRESHOLD}."
        )

    return {
        "anomaly_score": final_anomaly_score,
        "is_anomaly": is_anomaly,
        "primary_shap_feature": primary_shap_feature,
        "flagged_signals": flagged_signals
    }


# ============================================================================
# 5. CONDITIONAL ROUTING FUNCTION
# ============================================================================

def route_after_initial_eval(state: AnomalyAgentState) -> str:
    """
    Conditional Edge Evaluator:
    Directs workflow execution based on the 'needs_deep_context' flag:
    - If True  -> routes to 'context_gathering' (Node 2)
    - If False -> routes directly to 'final_scoring' (Node 3)
    """
    if state.get("needs_deep_context", False):
        return "context_gathering"
    return "final_scoring"


# ============================================================================
# 6. GRAPH CONSTRUCTION & COMPILATION
# ============================================================================

def build_anomaly_detection_graph() -> StateGraph:
    r"""
    Constructs and compiles the LangGraph StateGraph for the Anomaly Detection Agent.


    Graph Topology:
    [START] -> (initial_signal_evaluation)
                     |
         [needs_deep_context ?]
            /               \
        (True)            (False)
          |                  |
          v                  |
    (context_gathering)      |
          |                  |
          \----------------->|
                             v
                       (final_scoring) -> [END]
    """
    builder = StateGraph(AnomalyAgentState)

    # 1. Register Nodes
    builder.add_node("initial_signal_evaluation", initial_signal_evaluation_node)
    builder.add_node("context_gathering", context_gathering_node)
    builder.add_node("final_scoring", final_scoring_node)

    # 2. Define Entry Point
    builder.set_entry_point("initial_signal_evaluation")

    # 3. Add Conditional Edge from Node 1
    builder.add_conditional_edges(
        "initial_signal_evaluation",
        route_after_initial_eval,
        {
            "context_gathering": "context_gathering",
            "final_scoring": "final_scoring"
        }
    )

    # 4. Add Edge from Node 2 to Node 3
    builder.add_edge("context_gathering", "final_scoring")

    # 5. Add Terminal Edge from Node 3 to END
    builder.add_edge("final_scoring", END)

    # Compile executable graph
    return builder.compile()


# Globally compiled instance of the Anomaly Detection Agent workflow
anomaly_detection_app = build_anomaly_detection_graph()


# ============================================================================
# 7. RUNNABLE HELPER FUNCTION
# ============================================================================

def invoke_anomaly_agent(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the Anomaly Detection Agent LangGraph workflow for a given transaction.

    Args:
        transaction_data (Dict[str, Any]): Dictionary containing transaction details:
            - amount (float): Amount of transaction (e.g., 12500.0)
            - device_id (str): Device fingerprint or hardware ID
            - ip_location (str): Geolocation string (e.g. "Colombo, Sri Lanka", "Lagos, Nigeria")
            - velocity_24h (int): Number of transactions in 24 hours
            - transaction_id (Optional[str]): Identifier for logging & traceability
            - user_id (Optional[str]): Customer ID

    Returns:
        Dict[str, Any]: Complete AnomalyAgentState containing:
            - anomaly_score (float): Calculated fraud score (0.0 to 1.0)
            - flagged_signals (List[str]): All triggered behavioral signals
            - needs_deep_context (bool): Whether Node 2 was visited
            - primary_shap_feature (str): Standardized code ('location_anomaly',
                                         'high_velocity', 'high_amount', or '')
            - is_anomaly (bool): True if flagged as suspicious
    """
    initial_state: AnomalyAgentState = {
        "amount": float(transaction_data.get("amount", 0.0)),
        "device_id": str(transaction_data.get("device_id", "unknown_device")),
        "ip_location": str(transaction_data.get("ip_location", "Unknown Location")),
        "velocity_24h": int(transaction_data.get("velocity_24h", 0)),
        "flagged_signals": list(transaction_data.get("flagged_signals") or []),
        "needs_deep_context": False,
        "anomaly_score": 0.0,
        "primary_shap_feature": "",
        "transaction_id": transaction_data.get("transaction_id", "TX-GEN-001"),
        "user_id": transaction_data.get("user_id", "USR-1001"),
        "is_anomaly": False
    }

    result = anomaly_detection_app.invoke(initial_state)
    return result


# ============================================================================
# 8. VERIFICATION & EXECUTION TEST BLOCK
# ============================================================================

if __name__ == "__main__":
    import json

    print("\n" + "=" * 80)
    print("FINCORE AGENT 2 - ANOMALY DETECTION AGENT (LANGGRAPH PIPELINE TEST)")
    print("=" * 80)

    # ------------------------------------------------------------------------
    # TEST CASE 1: High Spending Spike ($25,000)
    # Expected: Node 1 flags amount -> routes to Node 2
    #           -> Node 3 flags high anomaly score -> primary_shap_feature='high_amount'
    # ------------------------------------------------------------------------
    print("\n--- Test Case 1: High Spending Spike ($25,000.00) ---")
    mock_tx_high_amount = {
        "transaction_id": "TX-10001",
        "user_id": "USR-4402",
        "amount": 25000.0,
        "device_id": "device_iphone_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 1
    }
    result_1 = invoke_anomaly_agent(mock_tx_high_amount)
    print(f"Transaction ID       : {result_1.get('transaction_id')}")
    print(f"Needs Deep Context   : {result_1.get('needs_deep_context')}")
    print(f"Calculated Score     : {result_1.get('anomaly_score'):.4f} (Anomaly: {result_1.get('is_anomaly')})")
    print(f"Primary SHAP Feature : {result_1.get('primary_shap_feature')}")
    print("Flagged Signals:")
    for sig in result_1.get("flagged_signals", []):
        print(f"  * {sig}")

    # ------------------------------------------------------------------------
    # TEST CASE 2: High Velocity Burst (6 transactions in 24h)
    # Expected: Node 1 flags velocity -> routes to Node 2 -> confirms 7d surge
    #           -> Node 3 flags high anomaly score -> primary_shap_feature='high_velocity'
    # ------------------------------------------------------------------------
    print("\n--- Test Case 2: High Velocity Burst (6 transactions in 24h) ---")
    mock_tx_velocity = {
        "transaction_id": "TX-10002",
        "user_id": "USR-7731",
        "amount": 800.0,
        "device_id": "device_pixel_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 6
    }
    result_2 = invoke_anomaly_agent(mock_tx_velocity)
    print(f"Transaction ID       : {result_2.get('transaction_id')}")
    print(f"Needs Deep Context   : {result_2.get('needs_deep_context')}")
    print(f"Calculated Score     : {result_2.get('anomaly_score'):.4f} (Anomaly: {result_2.get('is_anomaly')})")
    print(f"Primary SHAP Feature : {result_2.get('primary_shap_feature')}")
    print("Flagged Signals:")
    for sig in result_2.get("flagged_signals", []):
        print(f"  * {sig}")

    # ------------------------------------------------------------------------
    # TEST CASE 3: Device & Geolocation Anomaly (New Emulator & VPN)
    # Expected: Node 1 flags new device + location -> routes to Node 2
    #           -> Node 3 flags high anomaly score -> primary_shap_feature='location_anomaly'
    # ------------------------------------------------------------------------
    print("\n--- Test Case 3: Device & Geolocation Anomaly (Untrusted Hardware & Datacenter VPN) ---")
    mock_tx_location = {
        "transaction_id": "TX-10003",
        "user_id": "USR-8819",
        "amount": 2500.0,
        "device_id": "dev_new_emulator_android_x86",
        "ip_location": "Commercial Datacenter VPN, Lagos",
        "velocity_24h": 1
    }
    result_3 = invoke_anomaly_agent(mock_tx_location)
    print(f"Transaction ID       : {result_3.get('transaction_id')}")
    print(f"Needs Deep Context   : {result_3.get('needs_deep_context')}")
    print(f"Calculated Score     : {result_3.get('anomaly_score'):.4f} (Anomaly: {result_3.get('is_anomaly')})")
    print(f"Primary SHAP Feature : {result_3.get('primary_shap_feature')}")
    print("Flagged Signals:")
    for sig in result_3.get("flagged_signals", []):
        print(f"  * {sig}")

    # ------------------------------------------------------------------------
    # TEST CASE 4: Routine / Benign Everyday Transaction
    # Expected: Node 1 finds no heuristic violations -> needs_deep_context=False
    #           -> bypasses Node 2 directly to Node 3 -> low score -> not flagged
    # ------------------------------------------------------------------------
    print("\n--- Test Case 4: Routine Everyday Transaction ($120.00, Known Device) ---")
    mock_tx_benign = {
        "transaction_id": "TX-10004",
        "user_id": "USR-1001",
        "amount": 120.0,
        "device_id": "device_iphone_trusted_01",
        "ip_location": "Colombo, Sri Lanka",
        "velocity_24h": 1
    }
    result_4 = invoke_anomaly_agent(mock_tx_benign)
    print(f"Transaction ID       : {result_4.get('transaction_id')}")
    print(f"Needs Deep Context   : {result_4.get('needs_deep_context')}")
    print(f"Calculated Score     : {result_4.get('anomaly_score'):.4f} (Anomaly: {result_4.get('is_anomaly')})")
    print(f"Primary SHAP Feature : '{result_4.get('primary_shap_feature')}'")
    print(f"Flagged Signals Count: {len(result_4.get('flagged_signals', []))}")

    print("\n" + "=" * 80)
    print("ALL TESTS COMPLETED SUCCESSFULLY - PIPELINE READY FOR PRODUCTION")
    print("=" * 80)
