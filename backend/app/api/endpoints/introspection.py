from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.schemas import (
    ColumnInfoResponse,
    SchemaInfoResponse,
    TablesPageResponse,
    TableInfoResponse,
)
from app.services import introspection_service

router = APIRouter(
    prefix="/orgs/{org_id}/datasources/{ds_id}/introspect",
    tags=["introspection"],
)


@router.get("/schemas", response_model=list[SchemaInfoResponse])
async def get_schemas(
    ds_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all user-accessible schemas in the data source."""
    try:
        schemas = await introspection_service.list_schemas(db, current_user.org_id, ds_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to data source: {e}",
        )
    return [SchemaInfoResponse(schema_name=s.schema_name) for s in schemas]


@router.get("/tables", response_model=TablesPageResponse)
async def get_tables(
    ds_id: UUID,
    schema: str | None = Query(None, description="Filter by schema name"),
    search: str | None = Query(None, description="Search table name (partial match)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tables/views with pagination and optional search."""
    try:
        tables, total = await introspection_service.list_tables(
            db, current_user.org_id, ds_id,
            schema=schema, search=search, limit=limit, offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to data source: {e}",
        )
    return TablesPageResponse(
        tables=[
            TableInfoResponse(
                schema_name=t.schema_name,
                table_name=t.table_name,
                table_type=t.table_type,
                row_estimate=t.row_estimate,
            )
            for t in tables
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/columns", response_model=list[ColumnInfoResponse])
async def get_columns(
    ds_id: UUID,
    schema: str = Query(..., description="Schema name"),
    table: str = Query(..., description="Table name"),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List columns for a specific table."""
    try:
        columns = await introspection_service.list_columns(
            db, current_user.org_id, ds_id, schema=schema, table=table,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to data source: {e}",
        )
    return [
        ColumnInfoResponse(
            column_name=c.column_name,
            data_type=c.data_type,
            is_nullable=c.is_nullable,
            column_default=c.column_default,
            ordinal_position=c.ordinal_position,
        )
        for c in columns
    ]
