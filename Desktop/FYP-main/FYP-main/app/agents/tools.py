from typing import Dict, Any
from sqlalchemy import create_engine, inspect
import json

# ============================================================================
# Database Introspection Tool
# ============================================================================
def introspect_database(connection_string: str) -> str:
    """
    Introspect a database and extract schema information.
    Returns JSON with tables, columns, PKs, FKs, and indexes.
    """
    try:
        engine = create_engine(connection_string)
        inspector = inspect(engine)
        
        schema_graph = {"tables": {}}
        
        for table_name in inspector.get_table_names():
            columns = []
            for col in inspector.get_columns(table_name):
                columns.append({
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col["nullable"]
                })
            
            pk = inspector.get_pk_constraint(table_name)
            fks = inspector.get_foreign_keys(table_name)
            indexes = inspector.get_indexes(table_name)
            
            schema_graph["tables"][table_name] = {
                "columns": columns,
                "primary_key": pk.get("constrained_columns", []) if pk else [],
                "foreign_keys": fks,
                "indexes": indexes
            }
        
        engine.dispose()
        return json.dumps(schema_graph, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})


# ============================================================================
# Helper: Convert Schema to Documents
# ============================================================================
def schema_to_documents(schema_json: str):
    """
    Convert schema JSON to Phidata Document objects for knowledge base.
    """
    from phi.document import Document
    
    try:
        schema_graph = json.loads(schema_json)
        documents = []
        
        tables = schema_graph.get("tables", {})
        for table_name, table_info in tables.items():
            # Build readable description
            columns = table_info.get("columns", [])
            col_desc = ", ".join([f"{c['name']} ({c['type']})" for c in columns])
            
            content = f"Table: {table_name}\nColumns: {col_desc}\n"
            
            pk = table_info.get("primary_key", [])
            if pk:
                content += f"Primary Key: {', '.join(pk)}\n"
            
            fks = table_info.get("foreign_keys", [])
            if fks:
                fk_desc = []
                for fk in fks:
                    fk_cols = fk.get("constrained_columns", [])
                    ref_table = fk.get("referred_table")
                    ref_cols = fk.get("referred_columns", [])
                    fk_desc.append(f"{', '.join(fk_cols)} -> {ref_table}({', '.join(ref_cols)})")
                content += f"Foreign Keys: {'; '.join(fk_desc)}\n"
            
            documents.append(
                Document(
                    content=content,
                    name=f"table_{table_name}",
                    meta_data={
                        "table": table_name,
                        "type": "schema_fragment",
                        "column_count": len(columns)
                    }
                )
            )
        
        return documents
        
    except Exception as e:
        print(f"Error converting schema to documents: {e}")
        return []
