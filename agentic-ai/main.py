import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from agents.approval_coordinator_agent import (
    ApprovalCoordinatorAgent,
    FraudAssessmentInput,
    CoordinatorResult,
    DecisionDispatchInput
)
from agents.tool_use_agent import (
    ToolUseAgent,
    NotificationRequestInput
)

app = FastAPI(
    title="FinCore - Multi-Agent System (Component C & D)",
    description="Agentic AI service coordinating high-impact execution pauses, step-up challenges, dual approval gates, and external notification execution tool boundary.",
    version="1.0.0"
)

# Enable CORS for local development with React & backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

coordinator_agent = ApprovalCoordinatorAgent()
tool_use_agent = ToolUseAgent()


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "FinCore Multi-Agent Service",
        "components": ["Component C (Coordinator)", "Component D (Tool-Use)"],
        "version": "1.0.0"
    }


@app.post("/agent/coordinate", response_model=CoordinatorResult)
async def coordinate_transaction(assessment: FraudAssessmentInput):
    """
    Synthesizes signals from upstream models (Agent 1 & Agent 2), enforces circuit breaker policies,
    and returns resolution path: AUTO_APPROVE, HOLD_FOR_STEP_UP, or ESCALATE_TO_ANALYST.
    """
    try:
        result = await coordinator_agent.evaluate_and_coordinate(assessment)
        return result
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
    """
    Dispatches human analyst decision (Approve/Reject) downstream to Component A (settlement/reversal)
    and Component D (customer notification).
    Supports JSON request body or query parameters.
    """
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
    """
    Triggers external customer notification via Tool-Use Agent (Component D).
    Uses exponential backoff retry logic to post to ASP.NET Core backend.
    """
    try:
        result = await tool_use_agent.process_decision(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool-Use Agent error: {str(e)}")