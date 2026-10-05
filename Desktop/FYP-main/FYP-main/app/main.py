from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware  # 👈 ONLY THIS LINE ADDED
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import shutil
import uuid

# Import pipeline components
from app.agents.ingestion import ingest_database_schema
from app.agents.orchestrator import run_query_pipeline
from app.agents.executor import commit_dml

app = FastAPI(
    title="Agentic NL-to-SQL Pipeline API",
    description="Full-cycle NL-to-SQL system with Iterative Understanding, SQL Generation, and Safe Execution.",
    version="1.0.0"
)

# 👇 THIS BLOCK ADDED FOR CORS (NO OTHER CHANGES)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 👆 END OF CORS CONFIGURATION

# Storage for active sessions (In-memory for now, can be moved to DB)
# Stores {session_id: {"db_path": str, "namespace": str}}
sessions = {}

UPLOAD_DIR = "./uploaded_dbs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    session_id: str
    user_input: str

class ConfirmRequest(BaseModel):
    session_id: str
    sql: str

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "Agentic NL-to-SQL API is running",
        "version": "1.0.0"
    }

@app.post("/ingest")
async def ingest_db(file: UploadFile = File(...), namespace: Optional[str] = Form(None)):
    """
    Step 1: Upload a SQLite database and process its schema for RAG.
    """
    if not namespace:
        namespace = file.filename.split(".")[0]
    
    session_id = str(uuid.uuid4())
    db_path = os.path.join(UPLOAD_DIR, f"{session_id}_{file.filename}")
    
    with open(db_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        connection_string = f"sqlite:///{db_path}"
        # Trigger the ingestion pipeline (embeds schema fragments)
        ingest_database_schema(connection_string, namespace)
        
        sessions[session_id] = {
            "db_path": db_path,
            "namespace": namespace
        }
        
        return {
            "status": "success",
            "session_id": session_id,
            "namespace": namespace,
            "message": f"Database '{file.filename}' ingested successfully. You can now start chatting."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Step 2: Interactive chat endpoint.
    Chains Preprocessor -> Generator -> Executor.
    Supports iterative dialogue (clarifications) and read-only automation.
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please ingest a database first.")
    
    try:
        # run_query_pipeline handles the multi-agent coordination
        result = run_query_pipeline(
            raw_user_input=request.user_input,
            db_path=session["db_path"],
            namespace=session["namespace"],
            session_id=request.session_id
        )
        
        return {
            "session_id": request.session_id,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/confirm")
async def confirm_execution(request: ConfirmRequest):
    """
    Step 3: Explicit confirmation for DML (INSERT/UPDATE/DELETE) queries.
    Pass the generated SQL here after user approval.
    """
    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    try:
        exec_result = commit_dml(request.sql, session["db_path"])
        return {
            "session_id": request.session_id,
            "execution": exec_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # In production, use environment variables for host and port
    uvicorn.run(app, host="0.0.0.0", port=8000)