"use server";

import { config } from "./config";
import { endpoints } from "./endpoints";
import { setAuthCookies, getAuthCookies, clearAuthCookies } from "./cookies";

interface ApiResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function serverFetch<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
): Promise<ApiResult<T>> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store" as RequestCache,
    });

    // Handle empty responses (204 No Content)
    if (res.status === 204) {
      return { ok: true, data: undefined as unknown as T };
    }

    let data: any;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error("serverFetch non-JSON response:", res.status, text.slice(0, 200));
      return { ok: false, error: `Server error (${res.status})` };
    }

    if (!res.ok) {
      // If the backend returns 401, the token is invalid/expired — clear cookies
      if (res.status === 401) {
        await clearAuthCookies();
      }

      const detail = data.detail;
      let errorMsg = "Request failed";
      if (typeof detail === "string") {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg ?? JSON.stringify(e)).join("; ");
      }
      return { ok: false, error: errorMsg };
    }

    return { ok: true, data: data as T };
  } catch (err) {
    console.error("serverFetch error:", endpoint, err);
    return { ok: false, error: "Network error. Please try again." };
  }
}

/** Read the access token from httpOnly cookie */
async function getTokenFromCookie(): Promise<string | null> {
  const { accessToken } = await getAuthCookies();
  return accessToken;
}

// ---------- Auth Actions ----------

export async function signupAction(body: {
  email: string;
  password: string;
  full_name: string;
  org_name: string;
}) {
  return serverFetch<{ message: string; otp: string | null }>(
    endpoints.auth.signup,
    { method: "POST", body }
  );
}

export async function verifyEmailAction(body: { email: string; otp: string }) {
  return serverFetch<{ message: string }>(endpoints.auth.verifyEmail, {
    method: "POST",
    body,
  });
}

export async function loginAction(body: { email: string; password: string }) {
  const result = await serverFetch<{
    access_token: string | null;
    refresh_token: string | null;
    token_type: string;
    force_password_change: boolean;
    orgs: { id: string; name: string; slug: string; role: string }[] | null;
  }>(endpoints.auth.login, { method: "POST", body });

  // If single org (tokens returned directly), store in cookies
  if (result.ok && result.data?.access_token && result.data?.refresh_token && !result.data?.orgs?.length) {
    await setAuthCookies(result.data.access_token, result.data.refresh_token);
  }

  // Return safe data (no tokens exposed to client unless multi-org selection needed)
  if (result.ok && result.data) {
    const { orgs, force_password_change } = result.data;
    // For multi-org: keep temp token server-side by storing it temporarily
    if (orgs && orgs.length > 1 && result.data.access_token) {
      // Store temp token in cookie for org selection (short-lived)
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      cookieStore.set("temp_token", result.data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5, // 5 minutes
      });
    }
    return {
      ok: true,
      data: {
        force_password_change,
        orgs: orgs && orgs.length > 1 ? orgs : null,
      },
    };
  }

  return { ok: result.ok, error: result.error };
}

export async function selectOrgAction(body: { org_id: string }) {
  // Read temp token from cookie (set during multi-org login)
  const { cookies: getCookies } = await import("next/headers");
  const cookieStore = await getCookies();
  const tempToken = cookieStore.get("temp_token")?.value;
  if (!tempToken) {
    return { ok: false, error: "Session expired. Please log in again." };
  }

  const result = await serverFetch<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    force_password_change: boolean;
  }>(endpoints.auth.selectOrg, { method: "POST", body, token: tempToken });

  if (result.ok && result.data) {
    await setAuthCookies(result.data.access_token, result.data.refresh_token);
    cookieStore.delete("temp_token");
    return {
      ok: true,
      data: { force_password_change: result.data.force_password_change },
    };
  }

  return { ok: result.ok, error: result.error };
}

export async function refreshTokenAction() {
  const { refreshToken } = await getAuthCookies();
  if (!refreshToken) {
    return { ok: false, error: "No refresh token" };
  }

  const result = await serverFetch<{
    access_token: string;
    refresh_token: string;
  }>(endpoints.auth.refresh, {
    method: "POST",
    body: { refresh_token: refreshToken },
  });

  if (result.ok && result.data) {
    await setAuthCookies(result.data.access_token, result.data.refresh_token);
  }

  return { ok: result.ok, error: result.error };
}

export async function changePasswordAction(
  body: { current_password: string; new_password: string }
) {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const result = await serverFetch<{ message: string }>(endpoints.auth.changePassword, {
    method: "POST",
    body,
    token,
  });

  if (result.ok) {
    await clearAuthCookies();
  }

  return result;
}

export async function forgotPasswordAction(body: { email: string }) {
  return serverFetch<{ message: string; otp: string | null }>(
    endpoints.auth.forgotPassword,
    { method: "POST", body }
  );
}

export async function resetPasswordAction(body: {
  email: string;
  otp: string;
  new_password: string;
}) {
  return serverFetch<{ message: string }>(endpoints.auth.resetPassword, {
    method: "POST",
    body,
  });
}

// ---------- Profile Actions ----------

export async function getProfileAction() {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const role = getRoleFromToken(token);

  const result = await serverFetch<{
    id: string;
    email: string;
    full_name: string;
    is_email_verified: boolean;
    created_at: string;
  }>(endpoints.profile.me, { token });

  if (result.ok && result.data) {
    return { ...result, data: { ...result.data, role } };
  }
  return result;
}

export async function updateProfileAction(body: { full_name: string }) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  return serverFetch<{
    id: string;
    email: string;
    full_name: string;
    is_email_verified: boolean;
    created_at: string;
  }>(endpoints.profile.me, { method: "PATCH", body, token });
}

// ---------- Session Actions ----------

export async function logoutAction() {
  await clearAuthCookies();
}

export async function isAuthenticatedAction() {
  const { accessToken } = await getAuthCookies();
  return !!accessToken;
}

// ---------- User Management Actions ----------

/** Decode org_id from the JWT access token (no verification — server validates) */
function getOrgIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.org_id ?? null;
  } catch {
    return null;
  }
}

function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.role ?? null;
  } catch {
    return null;
  }
}

function getUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserIdAction(): Promise<string | null> {
  const token = await getTokenFromCookie();
  if (!token) return null;
  return getUserIdFromToken(token);
}

export async function createUserAction(body: {
  email: string;
  full_name: string;
  role: "admin" | "member";
}) {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const orgId = getOrgIdFromToken(token);
  if (!orgId) {
    return { ok: false, error: "No organization context" };
  }

  return serverFetch<{
    id: string;
    email: string;
    full_name: string;
    temp_password: string;
    role: string;
  }>(endpoints.users.create(orgId), { method: "POST", body, token });
}

export async function listMembersAction() {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const orgId = getOrgIdFromToken(token);
  if (!orgId) {
    return { ok: false, error: "No organization context" };
  }

  return serverFetch<{
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    joined_at: string;
  }[]>(endpoints.users.list(orgId), { token });
}

export async function updateMemberRoleAction(userId: string, role: "admin" | "member") {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const orgId = getOrgIdFromToken(token);
  if (!orgId) {
    return { ok: false, error: "No organization context" };
  }

  return serverFetch<{ message: string }>(
    endpoints.users.updateRole(orgId, userId),
    { method: "PATCH", body: { role }, token }
  );
}

export async function removeMemberAction(userId: string) {
  const token = await getTokenFromCookie();
  if (!token) {
    return { ok: false, error: "Not authenticated" };
  }

  const orgId = getOrgIdFromToken(token);
  if (!orgId) {
    return { ok: false, error: "No organization context" };
  }

  return serverFetch<{ message: string }>(
    endpoints.users.remove(orgId, userId),
    { method: "DELETE", token }
  );
}

// ---------- Data Source Actions ----------

export interface CatalogItem {
  key: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  default_port: number;
}

export interface DataSourcePayload {
  name: string;
  ds_type: "postgresql" | "mysql" | "mssql" | "mongodb";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  use_ssl: boolean;
}

export async function getDataSourceCatalogAction() {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<CatalogItem[]>(endpoints.datasources.catalog(orgId), { token });
}

export async function testDataSourceConnectionAction(body: Omit<DataSourcePayload, "name">) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{ success: boolean; message: string }>(
    endpoints.datasources.testConnection(orgId),
    { method: "POST", body, token }
  );
}

export async function createDataSourceAction(body: DataSourcePayload) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{
    id: string;
    name: string;
    ds_type: string;
    host: string;
    port: number;
    database: string;
    username: string;
    use_ssl: boolean;
    is_active: boolean;
    created_by: string;
    created_at: string;
  }>(endpoints.datasources.create(orgId), { method: "POST", body, token });
}

export async function listDataSourcesAction() {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{
    id: string;
    name: string;
    ds_type: string;
    host: string;
    port: number;
    database: string;
    username: string;
    use_ssl: boolean;
    is_active: boolean;
    created_by: string;
    created_at: string;
  }[]>(endpoints.datasources.list(orgId), { token });
}

export async function deleteDataSourceAction(dsId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{ message: string }>(
    endpoints.datasources.delete(orgId, dsId),
    { method: "DELETE", token }
  );
}

// ---------- Introspection Actions ----------

export interface SchemaInfo {
  schema_name: string;
}

export interface TableInfo {
  schema_name: string;
  table_name: string;
  table_type: string;
  row_estimate: number | null;
}

export interface TablesPage {
  tables: TableInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position: number;
}

export async function listSchemasAction(dsId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<SchemaInfo[]>(
    endpoints.introspection.schemas(orgId, dsId),
    { token }
  );
}

export async function listTablesAction(
  dsId: string,
  params?: { schema?: string; search?: string; limit?: number; offset?: number }
) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  const qs = new URLSearchParams();
  if (params?.schema) qs.set("schema", params.schema);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const queryString = qs.toString();
  const url = endpoints.introspection.tables(orgId, dsId) + (queryString ? `?${queryString}` : "");

  return serverFetch<TablesPage>(url, { token });
}

export async function listColumnsAction(dsId: string, schema: string, table: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  const qs = new URLSearchParams({ schema, table });
  return serverFetch<ColumnInfo[]>(
    endpoints.introspection.columns(orgId, dsId) + `?${qs.toString()}`,
    { token }
  );
}

// ---------- Query Execution Actions ----------

export interface QueryResultData {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
}

export async function executeQueryAction(dsId: string, sql: string, maxRows: number = 500) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };

  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<QueryResultData>(
    endpoints.query.execute(orgId, dsId),
    { method: "POST", body: { sql, max_rows: maxRows }, token }
  );
}

// ────── Visualization types ──────

export interface VisualizationListItem {
  id: string;
  title: string;
  description: string | null;
  chart_type: string;
  visibility: "private" | "public";
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

export interface VisualizationShareInfo {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  granted_by: string;
  created_at: string;
}

export interface VisualizationDetail {
  id: string;
  org_id: string;
  ds_id: string;
  created_by: string;
  creator_name: string;
  title: string;
  description: string | null;
  sql_query: string;
  chart_type: string;
  chart_config: Record<string, unknown>;
  visibility: "private" | "public";
  shared_with: VisualizationShareInfo[];
  created_at: string;
  updated_at: string;
}

// ────── Visualization actions ──────

export async function createVisualizationAction(body: {
  ds_id: string;
  title: string;
  description?: string;
  sql_query: string;
  chart_type: string;
  chart_config: Record<string, unknown>;
  visibility: "private" | "public";
}) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<VisualizationDetail>(
    endpoints.visualizations.create(orgId),
    { method: "POST", body, token }
  );
}

export async function listVisualizationsAction() {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<VisualizationListItem[]>(
    endpoints.visualizations.list(orgId),
    { token }
  );
}

export async function getVisualizationAction(vizId: string, dashboardId?: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  const url = dashboardId
    ? `${endpoints.visualizations.detail(orgId, vizId)}?dashboard_id=${dashboardId}`
    : endpoints.visualizations.detail(orgId, vizId);

  return serverFetch<VisualizationDetail>(url, { token });
}

export async function updateVisualizationAction(vizId: string, body: {
  title?: string;
  description?: string;
  sql_query?: string;
  chart_type?: string;
  chart_config?: Record<string, unknown>;
  visibility?: "private" | "public";
}) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<VisualizationDetail>(
    endpoints.visualizations.update(orgId, vizId),
    { method: "PATCH", body, token }
  );
}

export async function deleteVisualizationAction(vizId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<void>(
    endpoints.visualizations.delete(orgId, vizId),
    { method: "DELETE", token }
  );
}

export async function shareVisualizationAction(vizId: string, userIds: string[]) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<VisualizationShareInfo[]>(
    endpoints.visualizations.share(orgId, vizId),
    { method: "POST", body: { user_ids: userIds }, token }
  );
}

export async function removeShareAction(vizId: string, userId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<void>(
    endpoints.visualizations.removeShare(orgId, vizId, userId),
    { method: "DELETE", token }
  );
}

// ────── Visualization AI insights ──────

export interface VisualizationInsightsData {
  insights: string[];
  source: "gemini" | "templated";
  summary: Record<string, unknown>;
}

export async function generateVisualizationInsightsAction(
  vizId: string,
  columns: string[],
  rows: unknown[][],
  truncated: boolean = false,
  dashboardId?: string,
) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  const url = dashboardId
    ? `${endpoints.visualizations.insights(orgId, vizId)}?dashboard_id=${dashboardId}`
    : endpoints.visualizations.insights(orgId, vizId);

  return serverFetch<VisualizationInsightsData>(url, {
    method: "POST",
    body: { columns, rows, truncated },
    token,
  });
}

// ────── Dashboard types ──────

export interface DashboardListItem {
  id: string;
  title: string;
  description: string | null;
  visibility: "private" | "public";
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardShareInfo {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  granted_by: string;
  created_at: string;
}

export interface DashboardDetail {
  id: string;
  org_id: string;
  created_by: string;
  creator_name: string;
  title: string;
  description: string | null;
  layout: Record<string, unknown>;
  visibility: "private" | "public";
  shared_with: DashboardShareInfo[];
  created_at: string;
  updated_at: string;
}

// ────── Dashboard actions ──────

export async function createDashboardAction(body: {
  title: string;
  description?: string | null;
  layout: Record<string, unknown>;
  visibility: "private" | "public";
}) {
  try {
    const token = await getTokenFromCookie();
    if (!token) return { ok: false, error: "Not authenticated" } as const;
    const orgId = getOrgIdFromToken(token);
    if (!orgId) return { ok: false, error: "No organization context" } as const;

    console.log("[createDashboardAction] calling endpoint:", endpoints.dashboards.create(orgId));
    const result = await serverFetch<DashboardDetail>(
      endpoints.dashboards.create(orgId),
      { method: "POST", body, token }
    );
    console.log("[createDashboardAction] result ok:", result.ok, "error:", result.error);
    return result;
  } catch (err: any) {
    console.error("[createDashboardAction] UNCAUGHT:", err);
    return { ok: false, error: err?.message || "Unexpected server error" };
  }
}

export async function listDashboardsAction() {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<DashboardListItem[]>(
    endpoints.dashboards.list(orgId),
    { token }
  );
}

export async function getDashboardAction(dashId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<DashboardDetail>(
    endpoints.dashboards.detail(orgId, dashId),
    { token }
  );
}

export async function updateDashboardAction(dashId: string, body: {
  title?: string;
  description?: string | null;
  layout?: Record<string, unknown>;
  visibility?: "private" | "public";
}) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<DashboardDetail>(
    endpoints.dashboards.update(orgId, dashId),
    { method: "PATCH", body, token }
  );
}

export async function deleteDashboardAction(dashId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<void>(
    endpoints.dashboards.delete(orgId, dashId),
    { method: "DELETE", token }
  );
}

export async function shareDashboardAction(dashId: string, userIds: string[]) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<DashboardShareInfo[]>(
    endpoints.dashboards.share(orgId, dashId),
    { method: "POST", body: { user_ids: userIds }, token }
  );
}

export async function removeDashboardShareAction(dashId: string, userId: string) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<void>(
    endpoints.dashboards.removeShare(orgId, dashId, userId),
    { method: "DELETE", token }
  );
}

export interface VizAccessItem {
  user_id: string;
  user_name: string;
  inaccessible_vizs: { viz_id: string; title: string }[];
}

export async function checkDashboardVizAccessAction(dashId: string, userIds: string[]) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<VizAccessItem[]>(
    endpoints.dashboards.checkVizAccess(orgId, dashId),
    { method: "POST", body: { user_ids: userIds }, token }
  );
}

// ---------- Activity Tracking ----------

export interface TrackEventPayload {
  event_type: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
}

export async function trackActivityAction(event: TrackEventPayload) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<void>(
    endpoints.activity.log(orgId),
    { method: "POST", body: event, token }
  );
}

export async function trackActivityBatchAction(events: TrackEventPayload[]) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{ logged: number }>(
    endpoints.activity.batch(orgId),
    { method: "POST", body: { events }, token }
  );
}

export async function getActivitySummaryAction(days: number = 30) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<{
    total_events: number;
    events_by_type: { event_type: string; count: number; last_at: string }[];
    recent_resources: { resource_type: string; resource_id: string; event_type: string; created_at: string }[];
  }>(
    `${endpoints.activity.summary(orgId)}?days=${days}`,
    { token }
  );
}

export async function getPopularResourcesAction(resourceType?: string, days: number = 30) {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  let url = `${endpoints.activity.popular(orgId)}?days=${days}`;
  if (resourceType) url += `&resource_type=${resourceType}`;
  return serverFetch<{ resource_type: string; resource_id: string; view_count: number; unique_users: number }[]>(
    url,
    { token }
  );
}

// ---------- Overview ----------

export interface OverviewDashboardItem {
  id: string;
  title: string;
  visibility: string;
  creator_name: string;
  last_viewed?: string;
  view_count?: number;
  unique_users?: number;
  views_this_week?: number;
}

export interface OverviewVisualizationItem {
  id: string;
  title: string;
  chart_type: string;
  visibility: string;
  creator_name: string;
  last_viewed?: string;
}

export interface OverviewData {
  org_name: string;
  dashboard_count: number;
  visualization_count: number;
  datasource_count: number;
  member_count: number;
  queries_30d: number;
  ds_by_type: { ds_type: string; count: number }[];
  recent_dashboards: OverviewDashboardItem[];
  recent_visualizations: OverviewVisualizationItem[];
  popular_dashboards: OverviewDashboardItem[];
  trending_dashboards: OverviewDashboardItem[];
  activity_trend: { day: string; event_count: number }[];
  most_active_users: { user_id: string; full_name: string; event_count: number }[];
  total_dashboards_org: number;
  total_visualizations_org: number;
}

export async function getOverviewAction() {
  const token = await getTokenFromCookie();
  if (!token) return { ok: false, error: "Not authenticated" };
  const orgId = getOrgIdFromToken(token);
  if (!orgId) return { ok: false, error: "No organization context" };

  return serverFetch<OverviewData>(
    endpoints.activity.overview(orgId),
    { token }
  );
}
