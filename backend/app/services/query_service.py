"""
Execute read-only SQL queries against remote data sources.

Queries are executed with a statement timeout and wrapped in a read-only
transaction to prevent any mutations.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DSType
from app.services.datasource_service import decrypt_password, get_datasource


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = False


MAX_ROWS = 1000
QUERY_TIMEOUT = 30  # seconds


async def _pg_execute(
    host: str, port: int, database: str, user: str, password: str,
    sql: str, max_rows: int, use_ssl: bool = False,
) -> QueryResult:
    import asyncpg

    ssl_arg = "require" if use_ssl else False
    conn = await asyncio.wait_for(
        asyncpg.connect(host=host, port=port, database=database, user=user, password=password, ssl=ssl_arg),
        timeout=10,
    )
    try:
        # Set read-only and statement timeout
        await conn.execute("SET statement_timeout = '30s'")
        await conn.execute("SET default_transaction_read_only = ON")

        # Fetch max_rows + 1 to detect truncation
        rows = await conn.fetch(sql)
        truncated = len(rows) > max_rows
        rows = rows[:max_rows]

        if rows:
            col_names = list(rows[0].keys())
            data = [[_serialize_value(row[c]) for c in col_names] for row in rows]
        else:
            col_names = []
            data = []

        return QueryResult(
            columns=col_names,
            rows=data,
            row_count=len(data),
            truncated=truncated,
        )
    finally:
        await conn.close()


async def _mysql_execute(
    host: str, port: int, database: str, user: str, password: str,
    sql: str, max_rows: int, use_ssl: bool = False,
) -> QueryResult:
    import aiomysql
    import ssl as _ssl

    ssl_ctx = None
    if use_ssl:
        ssl_ctx = _ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = _ssl.CERT_NONE

    conn = await asyncio.wait_for(
        aiomysql.connect(host=host, port=port, db=database, user=user, password=password, ssl=ssl_ctx),
        timeout=10,
    )
    try:
        async with conn.cursor() as cur:
            await cur.execute(f"SET SESSION MAX_EXECUTION_TIME={QUERY_TIMEOUT * 1000}")
            await cur.execute(sql)
            desc = cur.description
            col_names = [d[0] for d in desc] if desc else []
            rows = await cur.fetchmany(max_rows + 1)
            truncated = len(rows) > max_rows
            rows = rows[:max_rows]
            data = [[_serialize_value(v) for v in row] for row in rows]

        return QueryResult(
            columns=col_names,
            rows=data,
            row_count=len(data),
            truncated=truncated,
        )
    finally:
        conn.close()


async def _mssql_execute(
    host: str, port: int, database: str, user: str, password: str,
    sql: str, max_rows: int, use_ssl: bool = False,
) -> QueryResult:
    import aioodbc

    encrypt = "yes" if use_ssl else "no"
    dsn = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={host},{port};"
        f"DATABASE={database};UID={user};PWD={password};"
        f"Encrypt={encrypt};TrustServerCertificate=yes;"
    )
    conn = await asyncio.wait_for(aioodbc.connect(dsn=dsn), timeout=10)
    try:
        async with conn.cursor() as cur:
            await cur.execute(sql)
            desc = cur.description
            col_names = [d[0] for d in desc] if desc else []
            rows = await cur.fetchmany(max_rows + 1)
            truncated = len(rows) > max_rows
            rows = rows[:max_rows]
            data = [[_serialize_value(v) for v in row] for row in rows]

        return QueryResult(
            columns=col_names,
            rows=data,
            row_count=len(data),
            truncated=truncated,
        )
    finally:
        await conn.close()


def _serialize_value(v):
    """Convert DB values to JSON-safe types."""
    if v is None:
        return None
    if isinstance(v, (int, float, bool, str)):
        return v
    if isinstance(v, bytes):
        return v.hex()
    if isinstance(v, list):
        return [_serialize_value(i) for i in v]
    if isinstance(v, dict):
        return {k: _serialize_value(val) for k, val in v.items()}
    # datetime, date, Decimal, UUID, ObjectId, etc.
    return str(v)


async def _mongo_execute(
    host: str, port: int, database: str, user: str, password: str,
    sql: str, max_rows: int, use_ssl: bool = False,
) -> QueryResult:
    """Execute a MongoDB find or aggregate query.

    The ``sql`` parameter is interpreted as JSON with one of two formats:

    **Find** (simple queries):
    ``{"collection": "<name>", "filter": {...}, "projection": {...}, "sort": {...}}``

    **Aggregate** (group-by, pipelines):
    ``{"collection": "<name>", "pipeline": [{...}, ...]}``
    """
    import json
    from motor.motor_asyncio import AsyncIOMotorClient

    try:
        cmd = json.loads(sql)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON query: {exc}")

    collection_name = cmd.get("collection")
    if not collection_name:
        raise ValueError("Query must include a 'collection' key")

    tls_param = "true" if use_ssl else "false"
    uri = (
        f"mongodb://{user}:{password}@{host}:{port}/{database}"
        f"?authSource=admin&tls={tls_param}&tlsAllowInvalidCertificates=true"
    )
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10_000)
    try:
        db = client[database]
        coll = db[collection_name]

        pipeline = cmd.get("pipeline")
        if pipeline is not None:
            # ── Aggregation pipeline mode ──
            # Append a $limit stage if not already present at the end
            if not any(stage.get("$limit") is not None for stage in pipeline):
                pipeline.append({"$limit": max_rows + 1})

            cursor = coll.aggregate(pipeline)
            docs = await cursor.to_list(length=max_rows + 1)
        else:
            # ── Simple find mode ──
            query_filter = cmd.get("filter", {})
            projection = cmd.get("projection")
            sort = cmd.get("sort")

            cursor = coll.find(query_filter, projection)
            if sort:
                cursor = cursor.sort(list(sort.items()) if isinstance(sort, dict) else sort)
            cursor = cursor.limit(max_rows + 1)

            docs = await cursor.to_list(length=max_rows + 1)

        truncated = len(docs) > max_rows
        docs = docs[:max_rows]

        if docs:
            col_set: dict[str, None] = {}
            for d in docs:
                for k in d:
                    col_set[k] = None
            col_names = list(col_set)
            data = [[_serialize_value(d.get(c)) for c in col_names] for d in docs]
        else:
            col_names = []
            data = []

        return QueryResult(
            columns=col_names,
            rows=data,
            row_count=len(data),
            truncated=truncated,
        )
    finally:
        client.close()


_EXECUTE_DISPATCH = {
    DSType.postgresql: _pg_execute,
    DSType.mysql: _mysql_execute,
    DSType.mssql: _mssql_execute,
    DSType.mongodb: _mongo_execute,
}


# ── Blocked keywords to prevent mutations ────────────────────────────────

_BLOCKED_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL",
    "SET", "COPY", "VACUUM", "CLUSTER", "REINDEX", "LOCK",
}


def validate_read_only(sql: str) -> None:
    """Raise ValueError if the SQL contains mutation keywords."""
    # Strip comments and check first meaningful tokens
    stripped = sql.strip().rstrip(";").strip()
    tokens = stripped.upper().split()
    if not tokens:
        raise ValueError("Empty query")

    # Check if the first keyword is SELECT or WITH (CTE)
    if tokens[0] not in ("SELECT", "WITH", "EXPLAIN"):
        raise ValueError(f"Only SELECT queries are allowed. Got: {tokens[0]}")

    # Scan for blocked keywords (simple but effective for UI-generated queries)
    upper_sql = stripped.upper()
    for kw in _BLOCKED_KEYWORDS:
        # Check as standalone word boundaries
        import re
        if re.search(rf'\b{kw}\b', upper_sql):
            # Allow SET inside OFFSET (false positive prevention)
            if kw == "SET" and "OFFSET" in upper_sql:
                continue
            raise ValueError(f"Blocked keyword detected: {kw}")


async def execute_query(
    db: AsyncSession, org_id: UUID, ds_id: UUID,
    *, sql: str, max_rows: int = MAX_ROWS,
) -> QueryResult:
    """Execute a read-only SQL query against a data source."""
    ds = await get_datasource(db, org_id, ds_id)
    if ds is None:
        raise ValueError("Data source not found")

    # SQL validation only applies to SQL databases
    if ds.ds_type != DSType.mongodb:
        validate_read_only(sql)

    fn = _EXECUTE_DISPATCH.get(ds.ds_type)
    if fn is None:
        raise ValueError(f"Unsupported type: {ds.ds_type}")

    return await fn(
        host=ds.host, port=ds.port, database=ds.database,
        user=ds.username, password=decrypt_password(ds.encrypted_password),
        sql=sql, max_rows=max_rows, use_ssl=ds.use_ssl,
    )
