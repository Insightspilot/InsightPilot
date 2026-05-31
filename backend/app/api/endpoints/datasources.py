from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user, require_role
from app.db.session import get_db
from app.models.models import OrgRole, DSType, DSCategory
from app.schemas.schemas import (
    CreateDataSourceRequest,
    DataSourceCatalogItem,
    DataSourceResponse,
    MessageResponse,
    TestConnectionRequest,
    TestConnectionResponse,
    UpdateDataSourceRequest,
)
from app.services import datasource_service

# ---------------------------------------------------------------------------
# Data-source catalog – single source of truth for supported types
# ---------------------------------------------------------------------------
DS_CATALOG: list[DataSourceCatalogItem] = [
    DataSourceCatalogItem(
        key=DSType.postgresql,
        name="PostgreSQL",
        category=DSCategory.sql,
        icon="postgresql",
        description="Open-source relational database known for reliability and feature richness",
        default_port=5432,
    ),
    DataSourceCatalogItem(
        key=DSType.mysql,
        name="MySQL",
        category=DSCategory.sql,
        icon="mysql",
        description="Popular open-source relational database for web applications",
        default_port=3306,
    ),
    DataSourceCatalogItem(
        key=DSType.mssql,
        name="SQL Server",
        category=DSCategory.sql,
        icon="mssql",
        description="Microsoft's enterprise relational database management system",
        default_port=1433,
    ),
    DataSourceCatalogItem(
        key=DSType.mongodb,
        name="MongoDB",
        category=DSCategory.nosql,
        icon="mongodb",
        description="Document-oriented NoSQL database for flexible, scalable applications",
        default_port=27017,
    ),
]

router = APIRouter(prefix="/orgs/{org_id}/datasources", tags=["data-sources"])


# ---------- Catalog (read-only, any authenticated org member) ----------

@router.get("/catalog", response_model=list[DataSourceCatalogItem])
async def get_catalog(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Return the list of supported data source types with metadata."""
    return DS_CATALOG


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    body: TestConnectionRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
):
    success, msg = await datasource_service.test_connection(
        ds_type=body.ds_type,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
        use_ssl=body.use_ssl,
    )
    return TestConnectionResponse(success=success, message=msg)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource(
    body: CreateDataSourceRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    ds = await datasource_service.create_datasource(
        db,
        org_id=current_user.org_id,
        created_by=current_user.user.id,
        name=body.name,
        ds_type=body.ds_type,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
        use_ssl=body.use_ssl,
    )
    return ds


@router.get("", response_model=list[DataSourceResponse])
async def list_datasources(
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    return await datasource_service.list_datasources(db, current_user.org_id)


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_datasource(
    ds_id: UUID,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    ds = await datasource_service.get_datasource(db, current_user.org_id, ds_id)
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    return ds


@router.patch("/{ds_id}", response_model=DataSourceResponse)
async def update_datasource(
    ds_id: UUID,
    body: UpdateDataSourceRequest,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    ds = await datasource_service.get_datasource(db, current_user.org_id, ds_id)
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    ds = await datasource_service.update_datasource(
        db,
        ds,
        name=body.name,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
        use_ssl=body.use_ssl,
    )
    return ds


@router.delete("/{ds_id}", response_model=MessageResponse)
async def delete_datasource(
    ds_id: UUID,
    current_user: CurrentUser = Depends(require_role(OrgRole.owner, OrgRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    ds = await datasource_service.get_datasource(db, current_user.org_id, ds_id)
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    await datasource_service.delete_datasource(db, ds)
    return MessageResponse(message="Data source deleted")
