import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import UploadResponse, ChatRequest, ChatResponse, ResetResponse
from rag import index_document, answer_question, reset_session

app = FastAPI(
    title="Document Intelligence API",
    description="Upload a PDF and ask questions about it using RAG",
    version="1.0.0"
)

#  CORS 
# Allows the Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#  Health Check 
# Lets Render/Railway know the server is alive
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Document Intelligence API is running"}

#  Upload Endpoint 
# Accepts a PDF file, indexes it, returns a session_id
@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    # Validate file type
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Save uploaded file to a temp location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = index_document(tmp_path)
        return UploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        os.unlink(tmp_path)

#  Chat Endpoint
# Accepts a question + session_id, returns an answer
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    result = answer_question(request.session_id, request.question)
    return ChatResponse(**result)

#  Reset Endpoint 
# Clears session so user can upload a new document
@app.delete("/reset/{session_id}", response_model=ResetResponse)
async def reset(session_id: str):
    reset_session(session_id)
    return ResetResponse(message=f"Session {session_id} cleared successfully.")