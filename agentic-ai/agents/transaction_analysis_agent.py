import os
import time
import logging
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TransactionAnalysisAgent")

# Pydantic model for a clean "case object"
class TransactionCase(BaseModel):
    transaction_id: str
    amount: float
    sender_id: str
    receiver_id: str
    timestamp: str
    status: str

# ---------------------------------------------------------
# S2 INTEGRATION HOOK
# ---------------------------------------------------------
def delegate_to_anomaly_detection_agent(case_data: TransactionCase) -> int:
    """
    Mock function representing the Anomaly-Detection Agent (Component S2).
    
    TODO (S2 Integration): 
    Replace this mock logic with actual communication to the Anomaly-Detection 
    Agent built by Member 2. This could be an API call, a gRPC request, 
    publishing to a Kafka/RabbitMQ queue, or invoking a direct Python function.
    
    Args:
        case_data (TransactionCase): The structured transaction data.
        
    Returns:
        int: A simulated risk score between 0 and 100.
    """
    logger.info(f"Delegating transaction {case_data.transaction_id} to Anomaly-Detection Agent...")
    
    # Simulate network/processing delay
    time.sleep(1)
    
    # Mock scoring logic for demonstration purposes
    # Transactions > 10,000 are flagged with high risk (> 80)
    if case_data.amount > 10000:
        return 85
    return 15

class TransactionIntakeClerk:
    """
    Role (Intake Clerk): Connects to PostgreSQL, polls for 'Pending' transactions, 
    delegates anomaly detection, and updates the final transaction status.
    """
    
    def __init__(self, db_url: str, polling_interval: int = 5):
        self.db_url = db_url
        self.polling_interval = polling_interval
        self.engine = None
        self._connect_to_db()

    def _connect_to_db(self):
        """Establish a connection to the PostgreSQL database."""
        try:
            # pool_pre_ping ensures connections are valid before using them
            self.engine = create_engine(self.db_url, pool_pre_ping=True)
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to the PostgreSQL database.")
        except SQLAlchemyError as e:
            logger.error(f"Failed to connect to the database: {e}")
            self.engine = None

    def _get_pending_transactions(self) -> list[TransactionCase]:
        """Fetch transactions with 'Pending' status and structure them."""
        if not self.engine:
            return []
            
        try:
            with self.engine.connect() as conn:
                # Retrieve pending transactions and lock them so other workers don't pick them up
                query = text("""
                    SELECT id, amount, sender_id, receiver_id, timestamp, status 
                    FROM transactions 
                    WHERE status = 'Pending' 
                    FOR UPDATE SKIP LOCKED
                """)
                result = conn.execute(query).fetchall()
                
                cases = []
                for row in result:
                    # Structure raw data into a defined Case Object (Pydantic model)
                    case = TransactionCase(
                        transaction_id=str(row[0]),
                        amount=float(row[1]),
                        sender_id=str(row[2]),
                        receiver_id=str(row[3]),
                        timestamp=str(row[4]),
                        status=str(row[5])
                    )
                    cases.append(case)
                return cases
                
        except SQLAlchemyError as e:
            logger.error(f"Error fetching pending transactions: {e}")
            # Reset engine to force reconnection on next poll if the connection dropped
            self.engine = None 
            return []

    def _update_transaction_status(self, transaction_id: str, new_status: str, risk_score: int):
        """Update the transaction status based on the anomaly detection result."""
        if not self.engine:
            return
            
        try:
            with self.engine.connect() as conn:
                # We can also store the risk_score in the database if the schema supports it
                query = text("""
                    UPDATE transactions 
                    SET status = :status, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = :id
                """)
                
                # Use conn.begin() for transaction management in SQLAlchemy 2.0+
                with conn.begin():
                    conn.execute(query, {"status": new_status, "id": transaction_id})
                    
                logger.info(f"Transaction {transaction_id} updated to '{new_status}' (Risk Score: {risk_score})")
                
        except SQLAlchemyError as e:
            logger.error(f"Error updating transaction {transaction_id}: {e}")

    def run(self):
        """Main polling loop."""
        logger.info("Intake Clerk Agent started. Polling for pending transactions...")
        
        while True:
            # Reconnect if database connection was lost
            if not self.engine:
                logger.warning("Database connection missing. Attempting to reconnect...")
                self._connect_to_db()
                time.sleep(self.polling_interval)
                continue

            cases = self._get_pending_transactions()
            
            if cases:
                logger.info(f"Found {len(cases)} pending transaction(s).")
                
                for case in cases:
                    logger.info(f"Processing case: {case.transaction_id}")
                    
                    # 1. Delegate the case object to the Anomaly-Detection Agent
                    risk_score = delegate_to_anomaly_detection_agent(case)
                    
                    # 2. Final Output determination
                    if risk_score > 80:
                        new_status = 'Held'
                    else:
                        new_status = 'Completed'
                        
                    # 3. Database Update
                    self._update_transaction_status(case.transaction_id, new_status, risk_score)
            
            # Sleep before next poll
            time.sleep(self.polling_interval)

if __name__ == "__main__":
    # Ensure necessary environment variables or fallbacks are set
    # Expected format: postgresql+psycopg2://user:password@host:port/dbname
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/fincore")
    
    agent = TransactionIntakeClerk(db_url=DATABASE_URL, polling_interval=5)
    
    try:
        agent.run()
    except KeyboardInterrupt:
        logger.info("Intake Clerk Agent stopped by user.")
