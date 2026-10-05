"""
Execution Service for NL → SQL Pipeline.
Handles safe execution, sandboxing for DML, and results reporting.
"""

import sqlite3
import pandas as pd
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

# Remove hardcoded DB_PATH.
# DB_PATH = "customer_deliveries.sqlite"

class ExecutionResult(BaseModel):
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    columns: Optional[List[str]] = None
    message: str
    is_sandboxed: bool = False
    affected_rows: int = 0

def execute_sql_safely(sql: str, db_path: str, is_dml: bool = False) -> ExecutionResult:
    """
    Executes SQL. If DML, uses a transaction with ROLLBACK to 'sandbox' and observe changes.
    """
    conn = sqlite3.connect(db_path)
    try:
        if is_dml:
            # SANDBOX MODE
            conn.isolation_level = None # Manual transaction management
            cursor = conn.cursor()
            cursor.execute("BEGIN")
            
            try:
                cursor.execute(sql)
                affected_rows = cursor.rowcount
                
                # We don't fetch data for DML usually, but we could inspect changes here
                # For now, we report the "affected rows" as observed in the sandbox
                
                cursor.execute("ROLLBACK")
                return ExecutionResult(
                    success=True,
                    message=f"SANDBOX: This query would affect {affected_rows} rows. Please confirm execution.",
                    is_sandboxed=True,
                    affected_rows=affected_rows
                )
            except Exception as e:
                cursor.execute("ROLLBACK")
                return ExecutionResult(success=False, message=f"Sandbox execution failed: {str(e)}")
        else:
            # READ-ONLY MODE
            df = pd.read_sql_query(sql, conn)
            return ExecutionResult(
                success=True,
                data=df.to_dict(orient="records"),
                columns=df.columns.tolist(),
                message="Query executed successfully."
            )
    except Exception as e:
        return ExecutionResult(success=False, message=f"Database error: {str(e)}")
    finally:
        conn.close()

def commit_dml(sql: str, db_path: str) -> ExecutionResult:
    """
    Actually executes and commits a DML query after user confirmation.
    """
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        affected_rows = cursor.rowcount
        conn.commit()
        return ExecutionResult(
            success=True,
            message=f"Success: {affected_rows} rows updated/inserted.",
            affected_rows=affected_rows
        )
    except Exception as e:
        return ExecutionResult(success=False, message=f"Commit failed: {str(e)}")
    finally:
        conn.close()
