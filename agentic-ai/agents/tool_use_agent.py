import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Union
import httpx
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger("tool_use_agent")
logging.basicConfig(level=logging.INFO)

# Target Endpoint for ASP.NET Core Backend
NOTIFICATION_API_URL = os.getenv(
    "NOTIFICATION_API_URL",
    os.getenv("FINCORE_API_URL", "http://localhost:5007/api").rstrip("/") + "/notifications/send"
)


class NotificationRequestInput(BaseModel):
    transaction_id: str
    user_id: int = 1
    recipient_contact: str = "+94771234567"
    recipient_name: str = "Customer Name"
    decision: str  # APPROVED, HELD, REJECTED (or HELD_FOR_REVIEW, SETTLED, etc.)
    reason: Optional[str] = None
    amount: float = 75000.0
    currency: str = "LKR"
    channel_details: str = "Twilio/Brevo Gateway"
    custom_message: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def handle_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'recipient' in data and 'recipient_contact' not in data:
                data['recipient_contact'] = data['recipient']
            if 'userId' in data and 'user_id' not in data:
                data['user_id'] = data['userId']
            if 'transactionId' in data and 'transaction_id' not in data:
                data['transaction_id'] = data['transactionId']
            if 'recipientName' in data and 'recipient_name' not in data:
                data['recipient_name'] = data['recipientName']
            if 'channelDetails' in data and 'channel_details' not in data:
                data['channel_details'] = data['channelDetails']
            if 'customMessage' in data and 'custom_message' not in data:
                data['custom_message'] = data['customMessage']
        return data


def format_customer_message(
    decision: str,
    amount: float = 0.0,
    currency: str = "LKR",
    reason: Optional[str] = None,
    custom_message: Optional[str] = None
) -> str:
    """
    Formats customer notification message based on decision type.
    """
    if custom_message:
        return custom_message

    norm_decision = decision.upper().strip() if decision else ""
    formatted_amount = f"{amount:,.0f}" if amount > 0 else "0"

    if norm_decision in ("APPROVED", "AUTO_APPROVE", "SETTLED"):
        return f"Security Alert: Your transfer of {currency} {formatted_amount} has been approved and settled successfully."
    elif norm_decision in ("HELD", "HELD_FOR_REVIEW", "HELD_FOR_STEP_UP", "STEP_UP_CHALLENGE", "ESCALATE_TO_ANALYST"):
        return f"Security Alert: Your transfer of {currency} {formatted_amount} has been held for review."
    elif norm_decision in ("REJECTED", "REVERSED", "DECLINED"):
        msg = f"Security Alert: Your transfer of {currency} {formatted_amount} has been rejected following security inspection."
        if reason:
            msg += f" Reason: {reason}"
        return msg
    else:
        return f"Security Alert: Your transfer of {currency} {formatted_amount} status is: {decision}."


def infer_notification_type(recipient: str) -> str:
    """
    Infers notification channel type (SMS vs Email).
    """
    if not recipient:
        return "SMS"
    if "@" in recipient:
        return "Email"
    return "SMS"


async def send_notification_tool(
    user_id: int,
    recipient: str,
    recipient_name: str,
    notification_type: str,
    message: str,
    channel_details: str = "Twilio/Brevo Gateway",
    api_url: Optional[str] = None,
    max_retries: int = 3,
    backoff_delays: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Notification dispatch tool.
    Invokes the ASP.NET Core backend endpoint with exponential backoff retry logic.
    Returns execution telemetry dictionary:
    {"status": "SENT" | "FAILED", "attempts": int, "channel": str, "timestamp": str, "error": str | None}
    """
    target_url = api_url or NOTIFICATION_API_URL
    delays = backoff_delays if backoff_delays is not None else [1.0, 2.0, 4.0]

    payload = {
        "userId": user_id,
        "recipient": recipient,
        "recipientName": recipient_name,
        "type": notification_type,
        "message": message,
        "channelDetails": channel_details
    }

    attempts = 0
    last_error = None

    for attempt in range(1, max_retries + 1):
        attempts = attempt
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(target_url, json=payload)
                if response.status_code in (200, 201):
                    logger.info(f"Notification sent successfully on attempt {attempt}")
                    return {
                        "status": "SENT",
                        "attempts": attempts,
                        "channel": notification_type,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "error": None
                    }
                else:
                    last_error = f"HTTP {response.status_code}: {response.text}"
                    logger.warning(f"Notification dispatch attempt {attempt} failed: {last_error}")
        except Exception as ex:
            last_error = f"{type(ex).__name__}: {str(ex)}"
            logger.warning(f"Notification dispatch attempt {attempt} encountered network error: {last_error}")

        if attempt < max_retries:
            delay = delays[attempt - 1] if (attempt - 1) < len(delays) else delays[-1]
            await asyncio.sleep(delay)

    logger.error(f"Notification dispatch permanently failed after {attempts} attempts. Last error: {last_error}")
    return {
        "status": "FAILED",
        "attempts": attempts,
        "channel": notification_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "error": last_error
    }


class ToolUseAgent:
    """
    Tool-Use Agent (Component D)
    External action execution boundary for the multi-agent system.
    Invoked when Approval-Coordinator Agent settles, rejects, or holds a transaction.
    Triggers external customer notifications safely without blocking or crashing core pipeline.
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        max_retries: int = 3,
        backoff_delays: Optional[List[float]] = None
    ):
        self.api_url = api_url
        self.max_retries = max_retries
        self.backoff_delays = backoff_delays

    async def execute_notification(
        self,
        input_data: Union[NotificationRequestInput, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Extracts decision attributes, formats customer message, invokes notification tool,
        and returns pipeline execution summary.
        """
        if isinstance(input_data, dict):
            req = NotificationRequestInput.model_validate(input_data)
        else:
            req = input_data

        formatted_message = format_customer_message(
            decision=req.decision,
            amount=req.amount,
            currency=req.currency,
            reason=req.reason,
            custom_message=req.custom_message
        )

        n_type = infer_notification_type(req.recipient_contact)

        telemetry = await send_notification_tool(
            user_id=req.user_id,
            recipient=req.recipient_contact,
            recipient_name=req.recipient_name,
            notification_type=n_type,
            message=formatted_message,
            channel_details=req.channel_details,
            api_url=self.api_url,
            max_retries=self.max_retries,
            backoff_delays=self.backoff_delays
        )

        return {
            "transaction_id": req.transaction_id,
            "user_id": req.user_id,
            "recipient": req.recipient_contact,
            "decision": req.decision,
            "message_sent": formatted_message,
            "notification_telemetry": telemetry,
            "status": telemetry["status"],
            "pipeline_logged": True
        }

    async def process_decision(
        self,
        input_data: Union[NotificationRequestInput, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Alias for execute_notification to match coordinator integration.
        """
        return await self.execute_notification(input_data)


async def tool_use_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node function for Tool-Use Agent execution boundary.
    Extracts decision parameters from pipeline state, executes notification dispatch,
    and appends telemetry summary into state.
    """
    agent = ToolUseAgent()
    payload = state.get("decision_payload") or state
    result = await agent.execute_notification(payload)

    updated_state = dict(state)
    updated_state["notification_result"] = result
    updated_state["action_summary"] = {
        "agent": "ToolUseAgent",
        "transaction_id": result["transaction_id"],
        "status": result["status"],
        "telemetry": result["notification_telemetry"]
    }
    return updated_state
