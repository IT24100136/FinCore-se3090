import os
import logging
from typing import Optional, Dict, Any, List, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Agent 1: Transaction Analysis Agent
from agents.transaction_analysis_agent import (
    TransactionAnalysisAgent,
    TransactionAnalysisInput,
    TransactionAnalysisResult
)

# Agent 2: Anomaly Detection Agent
from agents.anomaly_detection_agent import (
    invoke_anomaly_agent,
    build_anomaly_detection_graph
)

# Agent 3: Approval Coordinator Agent
from agents.approval_coordinator_agent import (
    ApprovalCoordinatorAgent,
    FraudAssessmentInput,
    CoordinatorResult,
    DecisionDispatchInput
)

# Agent 4: Tool-Use Agent
from agents.tool_use_agent import (
    ToolUseAgent,
    NotificationRequestInput
)

# SHAP Explainability Service
import shap_service

logger = logging.getLogger("FinCoreMultiAgent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(
    title="FinCore - Multi-Agent Fraud Intelligence Platform",
    description="Unified orchestration for Agents 1-4: Transaction Analysis, Anomaly Detection, Approval Coordination, and Tool-Use.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agent singletons
tx_analysis_agent = TransactionAnalysisAgent()
coordinator_agent = ApprovalCoordinatorAgent()
tool_use_agent = ToolUseAgent()


class MultiAgentEvaluateRequest(BaseModel):
    transaction_id: str
    user_id: str = "USR-1001"
    amount: float
    recipient_id: str
    note: Optional[str] = None
    ip_address: Optional[str] = "127.0.0.1"
    device_id: Optional[str] = "mobile_device_default"
    velocity_24h: Optional[int] = 1
    prev_tx_lat: Optional[float] = None
    prev_tx_lon: Optional[float] = None
    prev_tx_timestamp: Optional[str] = None
    current_lat: Optional[float] = 6.9271
    current_lon: Optional[float] = 79.8612
    current_timestamp: Optional[str] = None
    recipient_contact: Optional[str] = None
    recipient_name: Optional[str] = None
    historical_transactions: Optional[List[Dict[str, Any]]] = None


class MultiAgentEvaluateResponse(BaseModel):
    transaction_id: str
    decision: str              # AUTO_APPROVE | STEP_UP_CHALLENGE | ESCALATE_TO_ANALYST
    status: str                # APPROVED | HELD_FOR_STEP_UP | HELD_FOR_REVIEW
    composite_risk_score: float
    requires_human_approval: bool
    requires_step_up: bool
    primary_shap_feature: str
    reasons: List[str]
    agent_1: Dict[str, Any]
    agent_2: Dict[str, Any]
    agent_3: Dict[str, Any]
    agent_4: Optional[Dict[str, Any]] = None


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "FinCore Multi-Agent Service",
        "agents": [
            "Agent 1: Transaction Analysis Agent (Spending Profile & 90d Window)",
            "Agent 2: Anomaly Detection Agent (LangGraph Behavioral Signals & Deep Context)",
            "Agent 3: Human-Approval Coordinator Agent (Policies & Dynamic Resolution)",
            "Agent 4: Tool-Use Agent (Side-effects, Step-up Challenge, Dispatch)"
        ],
        "version": "2.0.0"
    }


@app.post("/api/agents/evaluate", response_model=MultiAgentEvaluateResponse)
async def evaluate_transaction_pipeline(request: MultiAgentEvaluateRequest):
    """
    Executes the complete 4-agent cooperative evaluation pipeline:
    1. Agent 1 analyzes spending baseline (evaluates amount deviation, novelty, notes; expands to 90d window on borderline).
    2. Agent 2 analyzes behavioral signals (velocity, spending spikes, new devices, login hours, impossible travel).
    3. Agent 3 synthesizes Agent 1 and Agent 2 outputs against business policies to determine exact resolution path.
    4. Agent 4 executes side effects (notification dispatch, audit telemetry).
    """
    try:
        # ── AGENT 1: Transaction Analysis Agent ──────────────────────────────
        tx_input = TransactionAnalysisInput(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            amount=request.amount,
            recipient_id=request.recipient_id,
            note=request.note,
            historical_transactions=request.historical_transactions
        )
        agent1_result = await tx_analysis_agent.evaluate_transaction(tx_input)

        # ── AGENT 2: Anomaly Detection Agent ─────────────────────────────────
        anomaly_payload = {
            "transaction_id": request.transaction_id,
            "user_id": request.user_id,
            "amount": request.amount,
            "device_id": request.device_id,
            "ip_location": request.ip_address,
            "velocity_24h": request.velocity_24h,
            "prev_tx_lat": request.prev_tx_lat,
            "prev_tx_lon": request.prev_tx_lon,
            "prev_tx_timestamp": request.prev_tx_timestamp,
            "current_lat": request.current_lat,
            "current_lon": request.current_lon,
            "current_timestamp": request.current_timestamp,
        }
        agent2_result = invoke_anomaly_agent(anomaly_payload)

        # ── AGENT 3: Human-Approval Coordinator Agent ────────────────────────
        # Agent 1 final_risk_score is 0-100; Agent 2 anomaly_score is 0.0-1.0
        agent1_score = agent1_result.final_risk_score
        agent2_score = float(agent2_result.get("anomaly_score", 0.0)) * 100.0

        # Weighted synthesis
        composite_score = round(0.45 * agent1_score + 0.55 * agent2_score, 1)
        composite_score = min(max(composite_score, 0.0), 100.0)

        all_reasons = list(agent1_result.reasons) + list(agent2_result.get("flagged_signals", []))
        # Deduplicate reasons while preserving order
        unique_reasons = []
        for r in all_reasons:
            if r and r not in unique_reasons:
                unique_reasons.append(r)

        assessment = FraudAssessmentInput(
            transaction_id=request.transaction_id,
            amount=request.amount,
            risk_score=composite_score,
            flag_reasons=unique_reasons,
            sender_id=request.user_id,
            receiver_id=request.recipient_id
        )
        agent3_result = await coordinator_agent.evaluate_and_coordinate(assessment)

        # ── AGENT 4: Tool-Use Agent ──────────────────────────────────────────
        side_effect_result = None
        if agent3_result.action_taken in ("STEP_UP_CHALLENGE", "ESCALATE_TO_ANALYST"):
            try:
                notify_input = NotificationRequestInput(
                    transaction_id=request.transaction_id,
                    user_id=1,
                    recipient_contact=request.recipient_contact or request.recipient_id,
                    recipient_name=request.recipient_name or "Valued Customer",
                    decision=agent3_result.action_taken,
                    amount=request.amount,
                    reason="; ".join(unique_reasons[:2])
                )
                side_effect_result = await tool_use_agent.execute_notification(notify_input)
            except Exception as e:
                logger.warning(f"Agent 4 notification execution non-fatal warning: {e}")
                side_effect_result = {"status": "DEFERRED", "error": str(e)}

        primary_shap = agent2_result.get("primary_shap_feature") or ""

        return MultiAgentEvaluateResponse(
            transaction_id=request.transaction_id,
            decision=agent3_result.action_taken,
            status=agent3_result.status,
            composite_risk_score=composite_score,
            requires_human_approval=agent3_result.requires_human_approval,
            requires_step_up=agent3_result.requires_step_up,
            primary_shap_feature=primary_shap,
            reasons=unique_reasons,
            agent_1=agent1_result.model_dump(),
            agent_2=agent2_result,
            agent_3=agent3_result.model_dump(),
            agent_4=side_effect_result
        )
    except Exception as e:
        logger.error(f"Error executing multi-agent pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Multi-Agent Pipeline error: {str(e)}")


# Maintain backward compatibility with individual component endpoints
@app.post("/agent/coordinate", response_model=CoordinatorResult)
async def coordinate_transaction(assessment: FraudAssessmentInput):
    try:
        return await coordinator_agent.evaluate_and_coordinate(assessment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coordinator Agent error: {str(e)}")


@app.post("/agent/dispatch-decision")
async def dispatch_decision(
    payload: Optional[DecisionDispatchInput] = None,
    transaction_id: Optional[str] = None,
    decision: Optional[str] = None,
    analyst_id: Optional[str] = None,
    notes: Optional[str] = None
):
    try:
        tx_id = payload.transaction_id if payload else transaction_id
        dec = payload.decision if payload else decision
        a_id = payload.analyst_id if payload else analyst_id
        nts = (payload.notes if payload else notes) or None

        if not tx_id or not dec or not a_id:
            raise HTTPException(
                status_code=400,
                detail="Fields 'transaction_id', 'decision', and 'analyst_id' are required."
            )

        return await coordinator_agent.dispatch_human_decision(
            transaction_id=tx_id,
            decision=dec,
            analyst_id=a_id,
            notes=nts
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error dispatching decision: {str(e)}")


@app.post("/agent/tools/notify")
async def notify_customer(payload: NotificationRequestInput):
    try:
        return await tool_use_agent.process_decision(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool-Use Agent error: {str(e)}")


# Expose SHAP explanation endpoint directly on the multi-agent service as well
@app.post("/api/fraud/explain", response_model=shap_service.ExplainTransactionResponse)
def explain_flagged_transaction(request: shap_service.ExplainTransactionRequest):
    req_features = request.features if isinstance(request.features, dict) else getattr(request, "features", {})
    req_id = request.transaction_id if hasattr(request, "transaction_id") else "TX-UNKNOWN"
    return shap_service.explainer_service.explain_transaction(features=req_features, transaction_id=req_id)