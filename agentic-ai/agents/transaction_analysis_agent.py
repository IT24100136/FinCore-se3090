"""
FinCore - Agent 1: Transaction Analysis Agent
==============================================
Component S1: Evaluates individual transactions against the user's historical
spending profile using a calibrated risk model:
- Amount deviation (relative to user baseline average & spending velocity)
- Recipient novelty (whether recipient is a known historical counterparty)
- Category / Note fit (behavioral keyword and channel consistency)

Adaptive Window Strategy:
When the computed risk score is borderline (35 <= score <= 65), the agent
dynamically expands its context window, pulling the user's extended 90-day
transaction history instead of the standard 30-day window, re-evaluating
recipient novelty and spending variance before finalizing its assessment.
"""

from __future__ import annotations

import os
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Database connectivity (optional for standalone / microservice mode)
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Configure logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("TransactionAnalysisAgent")

# Baseline Thresholds
DEFAULT_30D_BASELINE_AVG: float = 15000.0  # Default average transaction size in LKR
BORDERLINE_LOWER_THRESHOLD: float = 35.0   # Lower bound for borderline band
BORDERLINE_UPPER_THRESHOLD: float = 65.0   # Upper bound for borderline band

# Suspicious note/category indicators
HIGH_RISK_NOTE_KEYWORDS = [
    "crypto", "bitcoin", "usdt", "tor", "urgent", "wire", "offshore",
    "untraceable", "gift card", "darknet", "casino", "gambling"
]

BENIGN_NOTE_KEYWORDS = [
    "grocery", "supermarket", "utility", "bill", "rent", "salary",
    "dinner", "lunch", "fuel", "school", "tuition", "medical", "pharmacy"
]


class TransactionAnalysisInput(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    recipient_id: str
    note: Optional[str] = None
    timestamp: Optional[str] = None
    historical_transactions: Optional[List[Dict[str, Any]]] = None


class TransactionAnalysisResult(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    recipient_id: str
    
    # Core risk dimensions
    amount_deviation_ratio: float
    is_recipient_novel: bool
    category_fit_score: float  # 0.0 (perfect fit) to 1.0 (anomalous)
    
    # Adaptive window decision
    initial_risk_score: float
    final_risk_score: float
    history_window_days: int   # 30 or 90
    window_expanded: bool
    window_expansion_reason: Optional[str] = None
    
    # Assessment & reasons
    status: str                # LOW_RISK, BORDERLINE, HIGH_RISK
    reasons: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)


class TransactionAnalysisAgent:
    """
    Agent 1 - Transaction Analysis Agent
    """

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:postgres@localhost:5432/FinCore"
        )
        self.engine = None
        self._init_db()

    def _init_db(self):
        if not self.db_url:
            return
        try:
            self.engine = create_engine(self.db_url, pool_pre_ping=True)
        except Exception as e:
            logger.warning(f"Could not initialize PostgreSQL engine: {e}. Falling back to telemetry/in-memory mode.")
            self.engine = None

    def fetch_user_history(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Pulls user historical transactions for the requested day window (30 or 90 days).
        Queries PostgreSQL if available; otherwise returns empty list for fallback estimation.
        """
        if not self.engine:
            return []

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        try:
            with self.engine.connect() as conn:
                # Aligned with EF Core PostgreSQL "Transactions" & "Wallets" schema
                wallet_ids = []
                try:
                    clean_id = str(user_id).replace("USR-", "").strip()
                    uid_int = int(clean_id)
                    w_rows = conn.execute(
                        text('SELECT "Id" FROM "Wallets" WHERE "UserId" = :uid OR "Id" = :uid'),
                        {"uid": uid_int}
                    ).fetchall()
                    wallet_ids = [r[0] for r in w_rows]
                except (ValueError, TypeError):
                    pass

                if wallet_ids:
                    query = text("""
                        SELECT t."Id", t."Amount", t."ReferenceId", t."Timestamp", t."Status", t."Note",
                               t."SenderWalletId", t."ReceiverWalletId"
                        FROM "Transactions" t
                        WHERE t."SenderWalletId" = ANY(:wids) AND t."Timestamp" >= :cutoff
                        ORDER BY t."Timestamp" DESC
                    """)
                    rows = conn.execute(query, {"wids": wallet_ids, "cutoff": cutoff_date}).fetchall()
                else:
                    rows = []

                # Fallback to system recent history if this specific user has no prior history
                if not rows:
                    query_fallback = text("""
                        SELECT t."Id", t."Amount", t."ReferenceId", t."Timestamp", t."Status", t."Note",
                               t."SenderWalletId", t."ReceiverWalletId"
                        FROM "Transactions" t
                        WHERE t."Timestamp" >= :cutoff
                        ORDER BY t."Timestamp" DESC
                        LIMIT 50
                    """)
                    rows = conn.execute(query_fallback, {"cutoff": cutoff_date}).fetchall()

                history = []
                for row in rows:
                    history.append({
                        "id": row[0],
                        "amount": float(row[1]),
                        "reference_id": str(row[2]),
                        "timestamp": row[3],
                        "status": str(row[4]),
                        "note": str(row[5] or ""),
                        "sender_wallet_id": row[6],
                        "receiver_wallet_id": row[7]
                    })
                return history
        except SQLAlchemyError as ex:
            logger.warning(f"Error fetching history from DB for window {days}d: {ex}")
            return []

    def _compute_profile_metrics(
        self,
        amount: float,
        recipient_id: str,
        note: str,
        history: List[Dict[str, Any]],
        window_days: int
    ) -> Dict[str, Any]:
        """
        Calculates amount deviation, recipient novelty, and category fit.
        """
        # 1. Historical Amount Baseline
        if history:
            amounts = [h["amount"] for h in history if h.get("amount", 0) > 0]
            avg_amount = sum(amounts) / len(amounts) if amounts else DEFAULT_30D_BASELINE_AVG
        else:
            avg_amount = DEFAULT_30D_BASELINE_AVG

        amount_ratio = amount / avg_amount if avg_amount > 0 else 1.0

        # Amount risk sub-score (0 to 45 pts)
        if amount_ratio <= 1.5:
            amount_score = 0.0
        elif amount_ratio <= 3.0:
            amount_score = 15.0
        elif amount_ratio <= 6.0:
            amount_score = 30.0
        else:
            amount_score = 45.0

        # 2. Recipient Novelty (0 to 35 pts)
        # Check if recipient was ever seen in the history window
        recipient_seen = False
        norm_recip = str(recipient_id).strip().lower()
        if history:
            for h in history:
                rec_id = str(h.get("receiver_wallet_id") or h.get("recipient_id") or "").strip().lower()
                note_text = str(h.get("note") or "").strip().lower()
                if norm_recip and (norm_recip in rec_id or norm_recip in note_text):
                    recipient_seen = True
                    break

        is_novel = not recipient_seen
        novelty_score = 30.0 if is_novel else 0.0

        # 3. Category / Note Fit (0 to 20 pts)
        note_clean = (note or "").lower().strip()
        category_score = 0.0
        if any(kw in note_clean for kw in HIGH_RISK_NOTE_KEYWORDS):
            category_score = 20.0
        elif any(kw in note_clean for kw in BENIGN_NOTE_KEYWORDS):
            category_score = 0.0
        elif len(note_clean) > 0:
            category_score = 5.0

        raw_score = amount_score + novelty_score + category_score
        bounded_score = min(max(raw_score, 0.0), 100.0)

        return {
            "amount_deviation_ratio": round(amount_ratio, 2),
            "avg_amount": round(avg_amount, 2),
            "is_recipient_novel": is_novel,
            "category_fit_score": round(category_score / 20.0, 2),
            "computed_score": bounded_score,
            "window_days": window_days,
            "history_count": len(history)
        }

    async def evaluate_transaction(self, input_data: TransactionAnalysisInput) -> TransactionAnalysisResult:
        """
        Executes spending profile evaluation with adaptive window expansion on borderline scores.
        """
        tx_id = input_data.transaction_id
        amount = input_data.amount
        recipient_id = input_data.recipient_id
        note = input_data.note or ""
        user_id = input_data.user_id

        logger.info(f"[{tx_id}] Agent 1 evaluating transaction: Amount={amount}, Recipient={recipient_id}")

        # Step 1: Gather standard 30-day baseline history
        if input_data.historical_transactions is not None:
            # Use caller provided historical telemetry
            history_30d = [
                h for h in input_data.historical_transactions
                if h.get("window_days", 30) <= 30
            ]
        else:
            history_30d = self.fetch_user_history(user_id, days=30)

        # Step 2: Compute initial risk score using 30-day baseline
        metrics_30d = self._compute_profile_metrics(
            amount=amount,
            recipient_id=recipient_id,
            note=note,
            history=history_30d,
            window_days=30
        )

        initial_score = metrics_30d["computed_score"]
        final_score = initial_score
        window_days = 30
        window_expanded = False
        expansion_reason = None
        reasons: List[str] = []

        if metrics_30d["amount_deviation_ratio"] > 2.0:
            reasons.append(
                f"Amount of Rs. {amount:,.0f} deviates {metrics_30d['amount_deviation_ratio']}x from user 30d average (Rs. {metrics_30d['avg_amount']:,.0f})"
            )

        if metrics_30d["is_recipient_novel"]:
            reasons.append(f"Novel counterparty: '{recipient_id}' not previously seen in user 30-day transfer history")

        # Step 3: BORDERLINE STRATEGY — Adaptive Window Decision
        # When score is in the borderline zone (35-65), pull extended 90-day history
        if BORDERLINE_LOWER_THRESHOLD <= initial_score <= BORDERLINE_UPPER_THRESHOLD:
            logger.info(
                f"[{tx_id}] Borderline score ({initial_score}) detected. Expanding window from 30d to 90d to refine baseline."
            )
            window_expanded = True
            window_days = 90
            expansion_reason = f"Initial score {initial_score:.1f} in borderline band [35-65]. Extended 90-day profile retrieved."

            if input_data.historical_transactions is not None:
                history_90d = input_data.historical_transactions
            else:
                history_90d = self.fetch_user_history(user_id, days=90)

            # Re-evaluate metrics with 90-day historical context
            metrics_90d = self._compute_profile_metrics(
                amount=amount,
                recipient_id=recipient_id,
                note=note,
                history=history_90d,
                window_days=90
            )

            # If recipient was transacted with in the older 31-90 day window,
            # clear the novelty penalty (prevents false positive on quarterly/recurrent payees)
            if not metrics_90d["is_recipient_novel"] and metrics_30d["is_recipient_novel"]:
                reasons.append(
                    f"Recipient '{recipient_id}' verified as recurring counterparty in extended 90-day history; novelty penalty cleared."
                )

            final_score = metrics_90d["computed_score"]
            active_metrics = metrics_90d
        else:
            active_metrics = metrics_30d

        # Determine status classification
        if final_score >= 70.0:
            status = "HIGH_RISK"
        elif final_score >= 40.0:
            status = "BORDERLINE"
        else:
            status = "LOW_RISK"

        if not reasons:
            reasons.append("Transaction conforms to customer historical spending baseline.")

        return TransactionAnalysisResult(
            transaction_id=tx_id,
            user_id=user_id,
            amount=amount,
            recipient_id=recipient_id,
            amount_deviation_ratio=active_metrics["amount_deviation_ratio"],
            is_recipient_novel=active_metrics["is_recipient_novel"],
            category_fit_score=active_metrics["category_fit_score"],
            initial_risk_score=initial_score,
            final_risk_score=final_score,
            history_window_days=window_days,
            window_expanded=window_expanded,
            window_expansion_reason=expansion_reason,
            status=status,
            reasons=reasons,
            details={
                "baseline_average_amount": active_metrics["avg_amount"],
                "records_evaluated": active_metrics["history_count"]
            }
        )
