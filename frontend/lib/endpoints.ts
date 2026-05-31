export const endpoints = {
  // Auth
  auth: {
    signup: "/auth/signup",
    verifyEmail: "/auth/verify-email",
    login: "/auth/login",
    selectOrg: "/auth/select-org",
    refresh: "/auth/refresh",
    changePassword: "/auth/change-password",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
  },

  // Profile
  profile: {
    me: "/me",
  },

  // Organizations
  orgs: {
    list: "/orgs",
    detail: (orgId: string) => `/orgs/${orgId}`,
    update: (orgId: string) => `/orgs/${orgId}`,
    delete: (orgId: string) => `/orgs/${orgId}`,
  },

  // User Management (org-scoped)
  users: {
    create: (orgId: string) => `/orgs/${orgId}/users`,
    list: (orgId: string) => `/orgs/${orgId}/users`,
    detail: (orgId: string, userId: string) => `/orgs/${orgId}/users/${userId}`,
    updateRole: (orgId: string, userId: string) => `/orgs/${orgId}/users/${userId}/role`,
    remove: (orgId: string, userId: string) => `/orgs/${orgId}/users/${userId}`,
  },

  // Health
  health: "/health",

  // Data Sources (org-scoped)
  datasources: {
    catalog: (orgId: string) => `/orgs/${orgId}/datasources/catalog`,
    create: (orgId: string) => `/orgs/${orgId}/datasources`,
    list: (orgId: string) => `/orgs/${orgId}/datasources`,
    detail: (orgId: string, dsId: string) => `/orgs/${orgId}/datasources/${dsId}`,
    update: (orgId: string, dsId: string) => `/orgs/${orgId}/datasources/${dsId}`,
    delete: (orgId: string, dsId: string) => `/orgs/${orgId}/datasources/${dsId}`,
    testConnection: (orgId: string) => `/orgs/${orgId}/datasources/test-connection`,
  },

  // Introspection (org + datasource scoped)
  introspection: {
    schemas: (orgId: string, dsId: string) =>
      `/orgs/${orgId}/datasources/${dsId}/introspect/schemas`,
    tables: (orgId: string, dsId: string) =>
      `/orgs/${orgId}/datasources/${dsId}/introspect/tables`,
    columns: (orgId: string, dsId: string) =>
      `/orgs/${orgId}/datasources/${dsId}/introspect/columns`,
  },

  // Query execution (org + datasource scoped)
  query: {
    execute: (orgId: string, dsId: string) =>
      `/orgs/${orgId}/datasources/${dsId}/query`,
  },

  // Visualizations (org-scoped)
  visualizations: {
    create: (orgId: string) => `/orgs/${orgId}/visualizations`,
    list: (orgId: string) => `/orgs/${orgId}/visualizations`,
    detail: (orgId: string, vizId: string) => `/orgs/${orgId}/visualizations/${vizId}`,
    update: (orgId: string, vizId: string) => `/orgs/${orgId}/visualizations/${vizId}`,
    delete: (orgId: string, vizId: string) => `/orgs/${orgId}/visualizations/${vizId}`,
    share: (orgId: string, vizId: string) => `/orgs/${orgId}/visualizations/${vizId}/share`,
    removeShare: (orgId: string, vizId: string, userId: string) =>
      `/orgs/${orgId}/visualizations/${vizId}/share/${userId}`,
    insights: (orgId: string, vizId: string) => `/orgs/${orgId}/visualizations/${vizId}/insights`,
  },

  // Dashboards (org-scoped)
  dashboards: {
    create: (orgId: string) => `/orgs/${orgId}/dashboards`,
    list: (orgId: string) => `/orgs/${orgId}/dashboards`,
    detail: (orgId: string, dashId: string) => `/orgs/${orgId}/dashboards/${dashId}`,
    update: (orgId: string, dashId: string) => `/orgs/${orgId}/dashboards/${dashId}`,
    delete: (orgId: string, dashId: string) => `/orgs/${orgId}/dashboards/${dashId}`,
    share: (orgId: string, dashId: string) => `/orgs/${orgId}/dashboards/${dashId}/share`,
    removeShare: (orgId: string, dashId: string, userId: string) =>
      `/orgs/${orgId}/dashboards/${dashId}/share/${userId}`,
    checkVizAccess: (orgId: string, dashId: string) =>
      `/orgs/${orgId}/dashboards/${dashId}/check-viz-access`,
  },

  // Activity tracking (org-scoped)
  activity: {
    log: (orgId: string) => `/orgs/${orgId}/activity`,
    batch: (orgId: string) => `/orgs/${orgId}/activity/batch`,
    list: (orgId: string) => `/orgs/${orgId}/activity`,
    summary: (orgId: string) => `/orgs/${orgId}/activity/summary`,
    popular: (orgId: string) => `/orgs/${orgId}/activity/popular`,
    overview: (orgId: string) => `/orgs/${orgId}/activity/overview`,
  },
};
