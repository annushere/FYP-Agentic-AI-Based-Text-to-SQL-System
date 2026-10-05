from phi.vectordb.lancedb import LanceDb
from phi.embedder.sentence_transformer import SentenceTransformerEmbedder
from phi.knowledge import AssistantKnowledge
from app.agents.tools import introspect_database, schema_to_documents

def ingest_database_schema(connection_string: str, namespace: str, db_path: str = "./lancedb_data"):
    """
    Full ingestion pipeline:
    1. Introspect database schema
    2. Convert to documents
    3. Load into Knowledge Base
    
    This is a simple sequential function, not an agent.
    """
    print(f"[STEP 1/3] Introspecting database...")
    schema_json = introspect_database(connection_string)
    
    # Check for errors
    import json
    import os
    schema_data = json.loads(schema_json)
    if "error" in schema_data:
        raise Exception(f"Introspection failed: {schema_data['error']}")
    
    # Save schema JSON for manual proof-checking
    os.makedirs("schemas", exist_ok=True)
    schema_filename = f"schemas/{namespace}_schema.json"
    with open(schema_filename, "w") as f:
        json.dump(schema_data, f, indent=2)
    print(f"[INFO] Schema JSON saved to {schema_filename}")
    
    print(f"[STEP 2/3] Converting schema to documents...")
    documents = schema_to_documents(schema_json)
    
    if not documents:
        raise Exception("No documents created from schema")
    
    print(f"[STEP 3/3] Loading {len(documents)} documents into Knowledge Base...")
    
    # Create embedder
    embedder = SentenceTransformerEmbedder(
        model="all-MiniLM-L6-v2",
        dimensions=384
    )
    
    # Create vector DB
    vector_db = LanceDb(
        table_name=f"schema_{namespace}",
        uri=db_path,
        embedder=embedder
    )
    
    # Create Knowledge Base
    kb = AssistantKnowledge(vector_db=vector_db)
    
    # Load documents (this triggers embedding automatically)
    kb.load_documents(documents, upsert=True)
    
    print(f"[SUCCESS] Loaded {len(documents)} tables into namespace 'schema_{namespace}'")
    
    return {
        "status": "success",
        "namespace": namespace,
        "tables_count": len(documents),
        "table_name": f"schema_{namespace}"
    }
