@echo off
REM Launch all three services in separate windows so each one has its own logs.
REM Usage: start.bat

start "Frontend"      cmd /k "cd frontend && npm run dev"
start "Agent Service" cmd /k "python -u -m uvicorn agent_service.api.main:app --host 0.0.0.0 --port 8001"
start "Gateway"       cmd /k "cd backend-node && npm run dev"

echo Started: Frontend (:5173), Gateway (:8000), Agent Service (:8001)
