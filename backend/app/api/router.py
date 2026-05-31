from fastapi import APIRouter

from app.api.endpoints import activity, auth, dashboards, datasources, health, introspection, orgs, profile, query, users, visualizations

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(orgs.router)
api_router.include_router(users.router)
api_router.include_router(profile.router)
api_router.include_router(datasources.router)
api_router.include_router(introspection.router)
api_router.include_router(query.router)
api_router.include_router(visualizations.router)
api_router.include_router(dashboards.router)
api_router.include_router(activity.router)
