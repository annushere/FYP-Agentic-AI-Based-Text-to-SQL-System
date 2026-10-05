from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from app.agents.ingestion import ingest_database_schema

router = APIRouter()

class DatabaseCredentials(BaseModel):
    db_type: str  # e.g. "postgresql", "mysql", "sqlite"
    host: Optional[str] = ""
    port: Optional[int] = 0
    user: Optional[str] = ""
    password: Optional[str] = ""
    database: str

def process_ingestion(creds: DatabaseCredentials):
    """
    Background task: Run the ingestion pipeline.
    """
    print(f"\n{'='*60}")
    print(f"[INGESTION] Starting for database: {creds.database}")
    print(f"{'='*60}\n")
    
    # Build connection string
    if creds.db_type == "postgresql":
        conn_str = f"postgresql://{creds.user}:{creds.password}@{creds.host}:{creds.port}/{creds.database}"
    elif creds.db_type == "mysql":
        conn_str = f"mysql+pymysql://{creds.user}:{creds.password}@{creds.host}:{creds.port}/{creds.database}"
    elif creds.db_type == "sqlite":
        conn_str = f"sqlite:///{creds.database}"
    else:
        print(f"[ERROR] Unsupported db_type: {creds.db_type}")
        return
    
    try:
        # Run sequential pipeline
        result = ingest_database_schema(
            connection_string=conn_str,
            namespace=creds.database
        )
        
        print(f"\n{'='*60}")
        print(f"[COMPLETE] {result}")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n[ERROR] Ingestion failed: {e}")
        import traceback
        traceback.print_exc()



@router.post("/attach-db/")
async def attach_database(creds: DatabaseCredentials, background_tasks: BackgroundTasks):
    """
    Attach a database and trigger schema ingestion.
    """
    print(f"[API] Received request to attach database: {creds.database}")

    # Enqueue background job
    background_tasks.add_task(process_ingestion, creds)
    
    return {
        "status": "accepted",
        "message": f"Schema ingestion started for database '{creds.database}'",
        "db_type": creds.db_type,
        "namespace": f"schema_{creds.database}"
    }
