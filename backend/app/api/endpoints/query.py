from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.schemas import ExecuteQueryRequest, ExecuteQueryResponse
from app.services import query_service

router = APIRouter(
    prefix="/orgs/{org_id}/datasources/{ds_id}/query",
    tags=["query"],
)


@router.post("", response_model=ExecuteQueryResponse)
async def execute_query(
    ds_id: UUID,
    body: ExecuteQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a read-only SQL query against a data source."""
    try:
        result = await query_service.execute_query(
            db, current_user.org_id, ds_id,
            sql=body.sql, max_rows=body.max_rows,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Query execution failed: {e}",
        )
    return ExecuteQueryResponse(
        columns=result.columns,
        rows=result.rows,
        row_count=result.row_count,
        truncated=result.truncated,
    )
