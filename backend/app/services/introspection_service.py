"""
Introspect remote data-source databases to list schemas, tables, and columns.

Supports PostgreSQL, MySQL, and MSSQL.  Results are fetched live from the
target database — nothing is cached or persisted.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DSType
from app.services.datasource_service import decrypt_password, get_datasource


# ── Data classes ──────────────────────────────────────────────────────────

@dataclass
class SchemaInfo:
    schema_name: str


@dataclass
class TableInfo:
    schema_name: str
    table_name: str
    table_type: str  # "BASE TABLE" | "VIEW"
    row_estimate: int | None = None


@dataclass
class ColumnInfo:
    column_name: str
    data_type: str
    is_nullable: bool
    column_default: str | None = None
    ordinal_position: int = 0


# ── Helpers to connect to the remote DB ──────────────────────────────────

async def _pg_schemas(host: str, port: int, database: str, user: str, password: str, use_ssl: bool = False) -> list[SchemaInfo]:
    import asyncpg

    ssl_arg = "require" if use_ssl else False
    conn = await asyncio.wait_for(
        asyncpg.connect(host=host, port=port, database=database, user=user, password=password, ssl=ssl_arg),
        timeout=10,
    )
    try:
        rows = await conn.fetch(
            """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name
            """
        )
        return [SchemaInfo(schema_name=r["schema_name"]) for r in rows]
    finally:
        await conn.close()


async def _pg_tables(
    host: str, port: int, database: str, user: str, password: str,
    schema: str | None, search: str | None, limit: int, offset: int,
    use_ssl: bool = False,
) -> tuple[list[TableInfo], int]:
    import asyncpg

    ssl_arg = "require" if use_ssl else False
    conn = await asyncio.wait_for(
        asyncpg.connect(host=host, port=port, database=database, user=user, password=password, ssl=ssl_arg),
        timeout=10,
    )
    try:
        conditions = ["t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')"]
        args: list = []
        idx = 1

        if schema:
            conditions.append(f"t.table_schema = ${idx}")
            args.append(schema)
            idx += 1

        if search:
            conditions.append(f"t.table_name ILIKE ${idx}")
            args.append(f"%{search}%")
            idx += 1

        where = " AND ".join(conditions)

        count_row = await conn.fetchrow(
            f"SELECT COUNT(*) AS cnt FROM information_schema.tables t WHERE {where}",
            *args,
        )
        total = count_row["cnt"] if count_row else 0

        rows = await conn.fetch(
            f"""
            SELECT t.table_schema, t.table_name, t.table_type,
                   c.reltuples::bigint AS row_estimate
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
            WHERE {where}
            ORDER BY t.table_schema, t.table_name
            LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *args, limit, offset,
        )
        tables = [
            TableInfo(
                schema_name=r["table_schema"],
                table_name=r["table_name"],
                table_type=r["table_type"],
                row_estimate=max(r["row_estimate"], 0) if r["row_estimate"] is not None else None,
            )
            for r in rows
        ]
        return tables, total
    finally:
        await conn.close()


async def _pg_columns(
    host: str, port: int, database: str, user: str, password: str,
    schema: str, table: str, use_ssl: bool = False,
) -> list[ColumnInfo]:
    import asyncpg

    ssl_arg = "require" if use_ssl else False
    conn = await asyncio.wait_for(
        asyncpg.connect(host=host, port=port, database=database, user=user, password=password, ssl=ssl_arg),
        timeout=10,
    )
    try:
        rows = await conn.fetch(
            """
            SELECT column_name, data_type, is_nullable, column_default, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
            """,
            schema, table,
        )
        return [
            ColumnInfo(
                column_name=r["column_name"],
                data_type=r["data_type"],
                is_nullable=r["is_nullable"] == "YES",
                column_default=r["column_default"],
                ordinal_position=r["ordinal_position"],
            )
            for r in rows
        ]
    finally:
        await conn.close()


# ── MySQL helpers ────────────────────────────────────────────────────────

async def _mysql_schemas(host: str, port: int, database: str, user: str, password: str, use_ssl: bool = False) -> list[SchemaInfo]:
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
            await cur.execute(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name NOT IN ('information_schema','mysql','performance_schema','sys') "
                "ORDER BY schema_name"
            )
            rows = await cur.fetchall()
        return [SchemaInfo(schema_name=r[0]) for r in rows]
    finally:
        conn.close()


async def _mysql_tables(
    host: str, port: int, database: str, user: str, password: str,
    schema: str | None, search: str | None, limit: int, offset: int,
    use_ssl: bool = False,
) -> tuple[list[TableInfo], int]:
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
        conditions = ["table_schema NOT IN ('information_schema','mysql','performance_schema','sys')"]
        args: list = []

        if schema:
            conditions.append("table_schema = %s")
            args.append(schema)
        if search:
            conditions.append("table_name LIKE %s")
            args.append(f"%{search}%")

        where = " AND ".join(conditions)

        async with conn.cursor() as cur:
            await cur.execute(f"SELECT COUNT(*) FROM information_schema.tables WHERE {where}", args)
            total = (await cur.fetchone())[0]

            await cur.execute(
                f"SELECT table_schema, table_name, table_type, table_rows "
                f"FROM information_schema.tables WHERE {where} "
                f"ORDER BY table_schema, table_name LIMIT %s OFFSET %s",
                [*args, limit, offset],
            )
            rows = await cur.fetchall()

        tables = [
            TableInfo(schema_name=r[0], table_name=r[1], table_type=r[2], row_estimate=r[3])
            for r in rows
        ]
        return tables, total
    finally:
        conn.close()


async def _mysql_columns(
    host: str, port: int, database: str, user: str, password: str,
    schema: str, table: str, use_ssl: bool = False,
) -> list[ColumnInfo]:
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
            await cur.execute(
                "SELECT column_name, data_type, is_nullable, column_default, ordinal_position "
                "FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
                (schema, table),
            )
            rows = await cur.fetchall()
        return [
            ColumnInfo(
                column_name=r[0], data_type=r[1], is_nullable=r[2] == "YES",
                column_default=r[3], ordinal_position=r[4],
            )
            for r in rows
        ]
    finally:
        conn.close()


# ── MSSQL helpers ────────────────────────────────────────────────────────

async def _mssql_schemas(host: str, port: int, database: str, user: str, password: str, use_ssl: bool = False) -> list[SchemaInfo]:
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
            await cur.execute(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name NOT IN ('guest','INFORMATION_SCHEMA','sys') "
                "ORDER BY schema_name"
            )
            rows = await cur.fetchall()
        return [SchemaInfo(schema_name=r[0]) for r in rows]
    finally:
        await conn.close()


async def _mssql_tables(
    host: str, port: int, database: str, user: str, password: str,
    schema: str | None, search: str | None, limit: int, offset: int,
    use_ssl: bool = False,
) -> tuple[list[TableInfo], int]:
    import aioodbc

    encrypt = "yes" if use_ssl else "no"
    dsn = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={host},{port};"
        f"DATABASE={database};UID={user};PWD={password};"
        f"Encrypt={encrypt};TrustServerCertificate=yes;"
    )
    conn = await asyncio.wait_for(aioodbc.connect(dsn=dsn), timeout=10)
    try:
        conditions = ["table_schema NOT IN ('guest','INFORMATION_SCHEMA','sys')"]
        args: list = []

        if schema:
            conditions.append("table_schema = ?")
            args.append(schema)
        if search:
            conditions.append("table_name LIKE ?")
            args.append(f"%{search}%")

        where = " AND ".join(conditions)

        async with conn.cursor() as cur:
            await cur.execute(f"SELECT COUNT(*) FROM information_schema.tables WHERE {where}", args)
            total = (await cur.fetchone())[0]

            await cur.execute(
                f"SELECT table_schema, table_name, table_type "
                f"FROM information_schema.tables WHERE {where} "
                f"ORDER BY table_schema, table_name "
                f"OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                [*args, offset, limit],
            )
            rows = await cur.fetchall()

        tables = [
            TableInfo(schema_name=r[0], table_name=r[1], table_type=r[2])
            for r in rows
        ]
        return tables, total
    finally:
        await conn.close()


async def _mssql_columns(
    host: str, port: int, database: str, user: str, password: str,
    schema: str, table: str, use_ssl: bool = False,
) -> list[ColumnInfo]:
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
            await cur.execute(
                "SELECT column_name, data_type, is_nullable, column_default, ordinal_position "
                "FROM information_schema.columns "
                "WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
                (schema, table),
            )
            rows = await cur.fetchall()
        return [
            ColumnInfo(
                column_name=r[0], data_type=r[1], is_nullable=r[2] == "YES",
                column_default=r[3], ordinal_position=r[4],
            )
            for r in rows
        ]
    finally:
        await conn.close()


# ── MongoDB helpers ──────────────────────────────────────────────────────

async def _mongo_schemas(host: str, port: int, database: str, user: str, password: str, use_ssl: bool = False) -> list[SchemaInfo]:
    """MongoDB has no schemas – return the database name as the single schema."""
    return [SchemaInfo(schema_name=database)]


async def _mongo_tables(
    host: str, port: int, database: str, user: str, password: str,
    schema: str | None, search: str | None, limit: int, offset: int,
    use_ssl: bool = False,
) -> tuple[list[TableInfo], int]:
    """List MongoDB collections as tables."""
    from motor.motor_asyncio import AsyncIOMotorClient

    tls_param = "true" if use_ssl else "false"
    uri = (
        f"mongodb://{user}:{password}@{host}:{port}/{database}"
        f"?authSource=admin&tls={tls_param}&tlsAllowInvalidCertificates=true"
    )
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10_000)
    try:
        db = client[database]
        names = await db.list_collection_names()
        names.sort()

        if search:
            q = search.lower()
            names = [n for n in names if q in n.lower()]

        total = len(names)
        page = names[offset : offset + limit]

        tables: list[TableInfo] = []
        for name in page:
            try:
                count = await db[name].estimated_document_count()
            except Exception:
                count = None
            tables.append(
                TableInfo(
                    schema_name=database,
                    table_name=name,
                    table_type="COLLECTION",
                    row_estimate=count,
                )
            )
        return tables, total
    finally:
        client.close()


async def _mongo_columns(
    host: str, port: int, database: str, user: str, password: str,
    schema: str, table: str, use_ssl: bool = False,
) -> list[ColumnInfo]:
    """Infer fields by sampling documents from a MongoDB collection."""
    from motor.motor_asyncio import AsyncIOMotorClient

    tls_param = "true" if use_ssl else "false"
    uri = (
        f"mongodb://{user}:{password}@{host}:{port}/{database}"
        f"?authSource=admin&tls={tls_param}&tlsAllowInvalidCertificates=true"
    )
    client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10_000)
    try:
        db = client[database]
        coll = db[table]

        # Sample up to 100 documents to infer fields
        cursor = coll.find().limit(100)
        docs = await cursor.to_list(length=100)

        field_types: dict[str, set[str]] = {}
        for doc in docs:
            for key, value in doc.items():
                t = type(value).__name__
                field_types.setdefault(key, set()).add(t)

        columns: list[ColumnInfo] = []
        for idx, (field, types) in enumerate(field_types.items(), start=1):
            columns.append(
                ColumnInfo(
                    column_name=field,
                    data_type=" | ".join(sorted(types)),
                    is_nullable=True,
                    ordinal_position=idx,
                )
            )
        return columns
    finally:
        client.close()


# ── Dispatcher (public API) ──────────────────────────────────────────────

_SCHEMA_DISPATCH = {
    DSType.postgresql: _pg_schemas,
    DSType.mysql: _mysql_schemas,
    DSType.mssql: _mssql_schemas,
    DSType.mongodb: _mongo_schemas,
}

_TABLE_DISPATCH = {
    DSType.postgresql: _pg_tables,
    DSType.mysql: _mysql_tables,
    DSType.mssql: _mssql_tables,
    DSType.mongodb: _mongo_tables,
}

_COLUMN_DISPATCH = {
    DSType.postgresql: _pg_columns,
    DSType.mysql: _mysql_columns,
    DSType.mssql: _mssql_columns,
    DSType.mongodb: _mongo_columns,
}


async def list_schemas(
    db: AsyncSession, org_id: UUID, ds_id: UUID,
) -> list[SchemaInfo]:
    ds = await get_datasource(db, org_id, ds_id)
    if ds is None:
        raise ValueError("Data source not found")

    fn = _SCHEMA_DISPATCH.get(ds.ds_type)
    if fn is None:
        raise ValueError(f"Unsupported type: {ds.ds_type}")

    return await fn(
        host=ds.host, port=ds.port, database=ds.database,
        user=ds.username, password=decrypt_password(ds.encrypted_password),
        use_ssl=ds.use_ssl,
    )


async def list_tables(
    db: AsyncSession, org_id: UUID, ds_id: UUID,
    *, schema: str | None = None, search: str | None = None,
    limit: int = 50, offset: int = 0,
) -> tuple[list[TableInfo], int]:
    ds = await get_datasource(db, org_id, ds_id)
    if ds is None:
        raise ValueError("Data source not found")

    fn = _TABLE_DISPATCH.get(ds.ds_type)
    if fn is None:
        raise ValueError(f"Unsupported type: {ds.ds_type}")

    return await fn(
        host=ds.host, port=ds.port, database=ds.database,
        user=ds.username, password=decrypt_password(ds.encrypted_password),
        schema=schema, search=search, limit=limit, offset=offset,
        use_ssl=ds.use_ssl,
    )


async def list_columns(
    db: AsyncSession, org_id: UUID, ds_id: UUID,
    *, schema: str, table: str,
) -> list[ColumnInfo]:
    ds = await get_datasource(db, org_id, ds_id)
    if ds is None:
        raise ValueError("Data source not found")

    fn = _COLUMN_DISPATCH.get(ds.ds_type)
    if fn is None:
        raise ValueError(f"Unsupported type: {ds.ds_type}")

    return await fn(
        host=ds.host, port=ds.port, database=ds.database,
        user=ds.username, password=decrypt_password(ds.encrypted_password),
        schema=schema, table=table,
        use_ssl=ds.use_ssl,
    )
