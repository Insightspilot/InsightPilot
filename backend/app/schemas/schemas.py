from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.models import OrgRole, DSType, DSCategory, VisibilityType, ChartType


# ---------- Auth ----------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    org_name: str = Field(min_length=1, max_length=255)


class SignupResponse(BaseModel):
    message: str
    otp: str | None = None  # only in dev mode


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    force_password_change: bool = False
    orgs: list["OrgBrief"] | None = None  # returned when multiple orgs


class SelectOrgRequest(BaseModel):
    org_id: UUID


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    force_password_change: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


# ---------- Org ----------

class OrgBrief(BaseModel):
    id: UUID
    name: str
    slug: str
    role: OrgRole

    model_config = {"from_attributes": True}


class OrgDetail(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


# ---------- User Management ----------

class CreateUserRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: OrgRole = OrgRole.member


class CreateUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    temp_password: str
    role: OrgRole


class OrgMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    full_name: str
    role: OrgRole
    is_active: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: OrgRole


# ---------- Profile ----------

class UserProfile(BaseModel):
    id: UUID
    email: str
    full_name: str
    is_email_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)


class MessageResponse(BaseModel):
    message: str


# ---------- Data Sources ----------

class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ds_type: DSType
    host: str = Field(min_length=1, max_length=512)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=512)
    use_ssl: bool = False


class UpdateDataSourceRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    host: str | None = Field(None, min_length=1, max_length=512)
    port: int | None = Field(None, ge=1, le=65535)
    database: str | None = Field(None, min_length=1, max_length=255)
    username: str | None = Field(None, min_length=1, max_length=255)
    password: str | None = Field(None, min_length=1, max_length=512)
    use_ssl: bool | None = None


class DataSourceResponse(BaseModel):
    id: UUID
    name: str
    ds_type: DSType
    host: str
    port: int
    database: str
    username: str
    use_ssl: bool
    is_active: bool
    created_by: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TestConnectionRequest(BaseModel):
    ds_type: DSType
    host: str = Field(min_length=1, max_length=512)
    port: int = Field(ge=1, le=65535)
    database: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=512)
    use_ssl: bool = False


class TestConnectionResponse(BaseModel):
    success: bool
    message: str


class DataSourceCatalogItem(BaseModel):
    key: DSType
    name: str
    category: DSCategory
    icon: str
    description: str
    default_port: int


# ---------- Introspection ----------

class SchemaInfoResponse(BaseModel):
    schema_name: str


class TableInfoResponse(BaseModel):
    schema_name: str
    table_name: str
    table_type: str
    row_estimate: int | None = None


class TablesPageResponse(BaseModel):
    tables: list[TableInfoResponse]
    total: int
    limit: int
    offset: int


class ColumnInfoResponse(BaseModel):
    column_name: str
    data_type: str
    is_nullable: bool
    column_default: str | None = None
    ordinal_position: int = 0


# ---------- Query Execution ----------

class ExecuteQueryRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=10000)
    max_rows: int = Field(default=500, ge=1, le=1000)


class ExecuteQueryResponse(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool


# ---------- Visualizations ----------

class CreateVisualizationRequest(BaseModel):
    ds_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    sql_query: str = Field(min_length=1, max_length=10000)
    chart_type: ChartType
    chart_config: dict = Field(default_factory=dict)
    visibility: VisibilityType = VisibilityType.private


class UpdateVisualizationRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    sql_query: str | None = Field(default=None, min_length=1, max_length=10000)
    chart_type: ChartType | None = None
    chart_config: dict | None = None
    visibility: VisibilityType | None = None


class VisualizationShareRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1)


class VisualizationShareResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    user_name: str
    granted_by: UUID
    created_at: datetime


class VisualizationResponse(BaseModel):
    id: UUID
    org_id: UUID
    ds_id: UUID
    created_by: UUID
    creator_name: str
    title: str
    description: str | None
    sql_query: str
    chart_type: ChartType
    chart_config: dict
    visibility: VisibilityType
    shared_with: list[VisualizationShareResponse] = []
    created_at: datetime
    updated_at: datetime


class VisualizationListItem(BaseModel):
    id: UUID
    title: str
    description: str | None
    chart_type: ChartType
    visibility: VisibilityType
    created_by: UUID
    creator_name: str
    created_at: datetime
    updated_at: datetime


class GenerateInsightsRequest(BaseModel):
    columns: list[str] = Field(min_length=1)
    rows: list[list] = Field(default_factory=list)
    truncated: bool = False


class GenerateInsightsResponse(BaseModel):
    insights: list[str]
    source: str  # "gemini" | "templated"
    summary: dict


# ---------- Dashboards ----------

class CreateDashboardRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    layout: dict = Field(default_factory=dict)
    visibility: VisibilityType = VisibilityType.private


class UpdateDashboardRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    layout: dict | None = None
    visibility: VisibilityType | None = None


class DashboardShareRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1)


class DashboardVizAccessRequest(BaseModel):
    user_ids: list[UUID] = Field(min_length=1)


class DashboardVizAccessItem(BaseModel):
    user_id: UUID
    user_name: str
    inaccessible_vizs: list[dict]  # [{viz_id, title}]


class DashboardShareResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_email: str
    user_name: str
    granted_by: UUID
    created_at: datetime


class DashboardResponse(BaseModel):
    id: UUID
    org_id: UUID
    created_by: UUID
    creator_name: str
    title: str
    description: str | None
    layout: dict
    visibility: VisibilityType
    shared_with: list[DashboardShareResponse] = []
    created_at: datetime
    updated_at: datetime


class DashboardListItem(BaseModel):
    id: UUID
    title: str
    description: str | None
    visibility: VisibilityType
    created_by: UUID
    creator_name: str
    created_at: datetime
    updated_at: datetime


# ---------- Activity Logs ----------

class LogActivityRequest(BaseModel):
    event_type: str = Field(min_length=1, max_length=100)
    resource_type: str | None = Field(None, max_length=50)
    resource_id: UUID | None = None
    metadata: dict | None = None
    session_id: str | None = Field(None, max_length=100)


class LogActivityBatchRequest(BaseModel):
    events: list[LogActivityRequest] = Field(min_length=1, max_length=50)


class ActivityLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    org_id: UUID
    event_type: str
    resource_type: str | None
    resource_id: UUID | None
    metadata: dict | None
    session_id: str | None
    created_at: datetime


class ActivitySummaryItem(BaseModel):
    event_type: str
    count: int
    last_at: datetime


class UserActivitySummary(BaseModel):
    total_events: int
    events_by_type: list[ActivitySummaryItem]
    recent_resources: list[ActivityLogResponse]
