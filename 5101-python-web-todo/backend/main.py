from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth_router, users_router, categories_router, tasks_router, comments_router, stats_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="任务管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(categories_router.router)
app.include_router(tasks_router.router)
app.include_router(comments_router.router)
app.include_router(stats_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
