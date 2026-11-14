import os, uvicorn
if __name__ == "__main__":
    uvicorn.run("app.main:app", host=os.getenv("BACKEND_HOST", "127.0.0.1"),
                port=int(os.getenv("BACKEND_PORT", "8000")), reload=os.getenv("RELOAD", "1") == "1")
