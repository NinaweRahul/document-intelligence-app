from pydantic import BaseModel
from typing import Optional

# Upload Response 
# Returned after a PDF is successfully uploaded and indexed
class UploadResponse(BaseModel):
    session_id: str        # Unique ID for this document session
    filename: str          # Name of the uploaded file
    page_count: int        # Number of pages in the PDF
    chunk_count: int       # Number of chunks created

# Chat Request 
# Sent by the frontend when user asks a question
class ChatRequest(BaseModel):
    session_id: str        # Which session to query
    question: str          # The user's question

# Chat Response 
# Returned after generating an answer
class ChatResponse(BaseModel):
    answer: str            # The generated answer
    similarity_score: float  # Highest similarity score from retrieval
    is_in_scope: bool      # Whether the question was answered from docs

# Reset Request
# Sent when user wants to clear session and upload new doc
class ResetResponse(BaseModel):
    message: str