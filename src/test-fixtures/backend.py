from fastapi import FastAPI
import os  # Standard library: should NOT trigger warning
import sys  # Standard library: should NOT trigger warning
import httpx  # Intentional missing dependency: RepoPilot will flag a Warning in Problems!

app = FastAPI(title="RepoPilot Test API")

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "repopilot-backend"}

@app.get("/api/v1/users")
def get_users():
    return [{"id": 1, "username": "alice"}, {"id": 2, "username": "bob"}]

@app.get("/api/v1/users/{id}")
def get_user_by_id(id: int):
    return {"id": id, "username": f"user_{id}"}

@app.post("/api/v1/projects")
def create_project(name: str):
    return {"id": 101, "name": name}
