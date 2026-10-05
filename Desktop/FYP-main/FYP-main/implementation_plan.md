# [Goal Description]
Develop a **Phidata-Native, Modular Query Execution Pipeline** that strictly follows your provided flowchart and API structure. The system uses four specialized agents/components:
1.  **PreprocessorAgent**: Normalizes prompts, checks ambiguity.
2.  **GeneratorAgent**: Retrieves context (RAG) and writes SQL.
3.  **ExecutorAgent**: Safely executes SQL in a sandbox.
4.  **RepairAgent**: Fixes SQL based on execution errors.

## User Review Required
> [!IMPORTANT]
> **Corrected Alignment**
> I have aligned the plan with your API code (`app/api/v1/query.py`) which imports 4 distinct agents.
> - **Preprocessor**: Implementing as a `phi.agent.Agent` for smart ambiguity detection.
> - **Generator**: Implementing as a `phi.agent.Agent` with `AssistantKnowledge` (LanceDB ragn).
> - **Repair**: Implementing as a `phi.agent.Agent` for error correction.
> - **Executor**: Implementing as a strict Python Service (Deterministic, no LLM needed for execution).

## Architectural Components

### 1. Preprocessor Agent (`app/agents/preprocessor.py`)
- **Role**: Understand user intent.
- **Phidata**: Uses `phi.agent.Agent` with instructions like "Classify intent: SQL, Question, or Error".
- **Logic**:
    - `process(prompt, db_id)`:
        1. Check for `en-query <name>` (Saved Query).
        2. If ambiguous, return `{"type": "question", "content": "Did you mean...?"}`.
        3. Else return `{"type": "norm_prompt", "content": normalized_text}`.

### 2. Generator Agent (`app/agents/generator.py`)
- **Role**: The core SQL writer.
- **Phidata**: Uses `phi.agent.Agent` with `AssistantKnowledge`.
- **Logic**:
    - `generate(prompt, db_id, history)`:
        1. Query `AssistantKnowledge` for schema context.
        2. Assemble prompt with schema + history.
        3. Call LLM to generate SQL.
        4. Validate output (no Markdown formatting).

### 3. Repair Agent (`app/agents/repair.py`)
- **Role**: Fix broken SQL.
- **Phidata**: Uses `phi.agent.Agent`.
- **Logic**:
    - `repair(sql, error, db_id)`:
        1. Provide SQL + Error Message.
        2. Ask LLM to explain fix and providing corrected SQL.

### 4. Executor Agent (`app/agents/executor.py`)
- **Role**: Safe execution sandbox.
- **Phidata**: Technically a Tool/Service, not an LLM Agent.
- **Logic**:
    - `execute_query(sql, db_id)`:
        1. Connect to DB (Read-Only user if possible).
        2. Set Statement Timeout (e.g., 5s).
        3. Enforce `LIMIT 100`.
        4. Run and return DataFrame/JSON.

---

## Proposed Implementation Phases

### Phase 1: Preprocessor & Generator (Core)
- **Goal**: `POST /generate` works end-to-end.
- **Implementation**:
    - `app/agents/preprocessor.py`: Classifying & rewriting prompts.
    - `app/agents/generator.py`: Connecting to RAG & generating SQL.

### Phase 2: Executor & Repair (Reliability)
- **Goal**: `POST /execute` works safely, and failed queries are auto-fixed.
- **Implementation**:
    - `app/agents/executor.py`: Sandbox logic.
    - `app/agents/repair.py`: Feedback loop implementation.
    - Wire `RepairAgent` into the API flow (on execution error).

## Verification Plan

### Automated Tests (`test_pipeline.py`)
- **Preprocessor**: Input "Show me users" -> Output `type="norm_prompt"`.
- **Generator**: Input normalized prompt -> Output valid SQL string.
- **Executor**: Input "SELECT 1" -> Output `{"data": [{"1": 1}]}`.
- **Repair**: Input invalid SQL + "Syntax Error" -> Output corrected SQL.
