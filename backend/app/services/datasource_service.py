from uuid import UUID

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import DataSource, DSType

# ---------------------------------------------------------------------------
# Encryption helpers – Fernet symmetric encryption for stored passwords
# ---------------------------------------------------------------------------

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.ENCRYPTION_KEY.encode())
    return _fernet


def encrypt_password(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()


# ---------------------------------------------------------------------------
# Connection test helpers
# ---------------------------------------------------------------------------

async def test_connection(
    ds_type: DSType,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    use_ssl: bool = False,
) -> tuple[bool, str]:
    """Try connecting to the given database. Returns (success, message)."""
    import asyncio
    import ssl as _ssl

    try:
        if ds_type == DSType.postgresql:
            import asyncpg  # already a project dependency

            ssl_arg = "require" if use_ssl else False
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=host,
                    port=port,
                    database=database,
                    user=username,
                    password=password,
                    ssl=ssl_arg,
                ),
                timeout=10,
            )
            version = await conn.fetchval("SELECT version()")
            await conn.close()
            return True, f"Connected — {version}"

        elif ds_type == DSType.mysql:
            try:
                import aiomysql
            except ImportError:
                return False, "MySQL driver (aiomysql) is not installed on the server"

            ssl_ctx = None
            if use_ssl:
                ssl_ctx = _ssl.create_default_context()
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = _ssl.CERT_NONE

            conn = await asyncio.wait_for(
                aiomysql.connect(
                    host=host,
                    port=port,
                    db=database,
                    user=username,
                    password=password,
                    ssl=ssl_ctx,
                ),
                timeout=10,
            )
            async with conn.cursor() as cur:
                await cur.execute("SELECT VERSION()")
                row = await cur.fetchone()
            conn.close()
            return True, f"Connected — MySQL {row[0]}" if row else "Connected"

        elif ds_type == DSType.mssql:
            try:
                import aioodbc
            except ImportError:
                return False, "MSSQL driver (aioodbc) is not installed on the server"

            encrypt = "yes" if use_ssl else "no"
            dsn = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={host},{port};"
                f"DATABASE={database};"
                f"UID={username};"
                f"PWD={password};"
                f"Encrypt={encrypt};TrustServerCertificate=yes;"
            )
            conn = await asyncio.wait_for(
                aioodbc.connect(dsn=dsn),
                timeout=10,
            )
            async with conn.cursor() as cur:
                await cur.execute("SELECT @@VERSION")
                row = await cur.fetchone()
            await conn.close()
            return True, f"Connected — {row[0][:80]}" if row else "Connected"

        elif ds_type == DSType.mongodb:
            try:
                from motor.motor_asyncio import AsyncIOMotorClient
            except ImportError:
                return False, "MongoDB driver (motor) is not installed on the server"

            tls_param = "true" if use_ssl else "false"
            uri = (
                f"mongodb://{username}:{password}@{host}:{port}/{database}"
                f"?authSource=admin&tls={tls_param}&tlsAllowInvalidCertificates=true"
            )
            client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10_000)
            try:
                info = await asyncio.wait_for(
                    client.server_info(),
                    timeout=10,
                )
                version = info.get("version", "unknown")
                return True, f"Connected — MongoDB {version}"
            finally:
                client.close()

        else:
            return False, f"Unsupported data source type: {ds_type}"

    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def create_datasource(
    db: AsyncSession,
    org_id: UUID,
    created_by: UUID,
    *,
    name: str,
    ds_type: DSType,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
    use_ssl: bool = False,
) -> DataSource:
    ds = DataSource(
        org_id=org_id,
        name=name,
        ds_type=ds_type,
        host=host,
        port=port,
        database=database,
        username=username,
        encrypted_password=encrypt_password(password),
        use_ssl=use_ssl,
        created_by=created_by,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


async def list_datasources(db: AsyncSession, org_id: UUID) -> list[DataSource]:
    result = await db.execute(
        select(DataSource)
        .where(DataSource.org_id == org_id, DataSource.is_active == True)
        .order_by(DataSource.created_at.desc())
    )
    return list(result.scalars().all())


async def get_datasource(db: AsyncSession, org_id: UUID, ds_id: UUID) -> DataSource | None:
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == ds_id,
            DataSource.org_id == org_id,
            DataSource.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def update_datasource(
    db: AsyncSession,
    ds: DataSource,
    *,
    name: str | None = None,
    host: str | None = None,
    port: int | None = None,
    database: str | None = None,
    username: str | None = None,
    password: str | None = None,
    use_ssl: bool | None = None,
) -> DataSource:
    if name is not None:
        ds.name = name
    if host is not None:
        ds.host = host
    if port is not None:
        ds.port = port
    if database is not None:
        ds.database = database
    if username is not None:
        ds.username = username
    if password is not None:
        ds.encrypted_password = encrypt_password(password)
    if use_ssl is not None:
        ds.use_ssl = use_ssl
    await db.flush()
    await db.refresh(ds)
    return ds


async def delete_datasource(db: AsyncSession, ds: DataSource) -> None:
    ds.is_active = False
    await db.flush()
