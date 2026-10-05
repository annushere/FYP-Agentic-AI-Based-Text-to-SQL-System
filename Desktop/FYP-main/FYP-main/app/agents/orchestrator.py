from typing import Dict, Any, Union, Optional, List
from pydantic import BaseModel, Field
from app.agents.preprocessor import preprocess_input, PreprocessorOutput
from app.agents.generator import generate_sql, GeneratorOutput
from app.agents.executor import execute_sql_safely, ExecutionResult

class PipelineResult(BaseModel):
    """
    Final result container for the full pipeline.
    """
    status: str = Field(..., description="success, clarification, confirmation_required, or error")
    user_message: str = Field(..., description="Message to show to the user")
    sql: Optional[str] = Field(None, description="The generated SQL if successful")
    explanation: Optional[str] = Field(None, description="SQL explanation if successful")
    data: Optional[List[Dict[str, Any]]] = Field(None, description="Query results")
    intent: Dict[str, Any] = Field(default_factory=dict)

MAX_RETRIES = 2

def run_query_pipeline(raw_user_input: str, db_path: str, namespace: str, session_id: str) -> Union[PipelineResult, PreprocessorOutput]:
    """
    Main entry point for the "Understand -> Retrieve -> Generate -> Execute" flow.
    Supports dynamic database paths, iterative dialogue, and session-based history.
    """
    # 1. Understand (Preprocessing)
    print(f"\n[PIPELINE] Stage 1: Preprocessing '{raw_user_input}'...")
    processed = preprocess_input(raw_user_input, db_path, session_id)

    # 2. Iterative Dialogue: If preprocessor asks for clarification, return it directly
    if processed.type == "clarification":
        print("[PIPELINE] Preprocessor requested clarification.")
        return processed

    # 3. Retrieve & Generate Loop (with Self-Correction)
    if processed.type == "norm_prompt":
        error_context = None
        current_attempt = 0
        
        while current_attempt <= MAX_RETRIES:
            print(f"[PIPELINE] Stage 2: Generating SQL (Attempt {current_attempt + 1})...")
            try:
                gen_result = generate_sql(
                    normalized_prompt=processed.content,
                    namespace=namespace,
                    db_path=db_path,
                    session_id=session_id,
                    intent=processed.intent,
                    error_context=error_context
                )
                
                # 4. Execute (Executor)
                print(f"[PIPELINE] Stage 3: Executing SQL (Dry Run/Sandbox)...")
                exec_result = execute_sql_safely(gen_result.sql, db_path, is_dml=gen_result.is_dml)
                
                if not exec_result.success:
                    print(f"[PIPELINE] Execution Failed. Retrying...")
                    error_context = exec_result.message
                    current_attempt += 1
                    continue

                # 5. Handle Results based on Query Type
                if gen_result.is_dml:
                    return PipelineResult(
                        status="confirmation_required",
                        user_message=f"SANDBOX RESULT: {exec_result.message}\nThis query will modify the database. Do you want to proceed?",
                        sql=gen_result.sql,
                        explanation=gen_result.explanation,
                        intent=processed.intent
                    )
                else:
                    return PipelineResult(
                        status="success",
                        user_message="Query executed successfully.",
                        sql=gen_result.sql,
                        explanation=gen_result.explanation,
                        data=exec_result.data,
                        intent=processed.intent
                    )

            except Exception as e:
                print(f"[PIPELINE] Critical Error in Loop: {e}")
                error_context = str(e)
                current_attempt += 1

        return PipelineResult(
            status="error",
            user_message=f"I tried fixing the query {MAX_RETRIES} times, but still failed: {error_context}"
        )

    return PipelineResult(
        status="error",
        user_message="I'm not sure how to handle this request."
    )

"""if __name__ == "__main__":
    # Test the combined flow
    test_prompts = [
        "Show me my latest deliveries",
        "What is the capital of Mars?",
        "Get all customers"
    ]
    
    for prompt in test_prompts:
        print(f"\n{'='*50}")
        print(f"TESTING: {prompt}")
        result = run_query_pipeline(prompt)
        print(f"STATUS: {result.status}")
        print(f"MESSAGE: {result.user_message}")
        if result.sql:
            print(f"SQL: {result.sql}")
        print(f"{'='*50}")"""
