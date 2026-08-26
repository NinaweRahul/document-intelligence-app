import os
import uuid
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

# Session Storage 
# Each session_id maps to its own FAISS index and chat history
sessions = {}

# Embedding Model 
embeddings = GoogleGenerativeAIEmbeddings(
    model='models/gemini-embedding-001',
    google_api_key=os.environ["GEMINI_API_KEY"]
)

# LLM
llm = ChatGoogleGenerativeAI(
    model='gemini-3.6-flash',
    google_api_key=os.environ["GEMINI_API_KEY"],
    temperature=0.0
)

# Grounded System Prompt
SYSTEM_PROMPT = """You are a helpful assistant that answers questions strictly 
based on the provided document context.

Rules:
1. Answer ONLY from the context below. Do not use external knowledge.
2. If the context does not contain enough information, respond exactly with: 
   "I don't have that information in the source documents."
3. If context is partially relevant, answer only what you can support.

Context:
{context}"""

# Load and Index Document
def index_document(file_path: str) -> dict:
    # Load PDF
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    # Chunk
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=int(512 * 0.15)
    )
    chunks = splitter.split_documents(pages)

    # Create FAISS index
    faiss_index = FAISS.from_documents(chunks, embeddings)

    # Create session
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "index": faiss_index,
        "chat_history": [],
        "filename": os.path.basename(file_path),
        "page_count": len(pages),
        "chunk_count": len(chunks)
    }

    return {
        "session_id": session_id,
        "filename": os.path.basename(file_path),
        "page_count": len(pages),
        "chunk_count": len(chunks)
    }

# Retrieve with Threshold
def retrieve_with_threshold(faiss_index, query: str, k: int = 5, threshold: float = 0.45):
    results = faiss_index.similarity_search_with_score(query, k=k)

    if not results:
        return None, 0.0

    # FAISS returns L2 distance — lower is better
    # Convert to similarity: 1 / (1 + distance)
    filtered = [
        (doc, 1 / (1 + score))
        for doc, score in results
        if (1 / (1 + score)) >= threshold
    ]

    if not filtered:
        max_sim = max(1 / (1 + score) for _, score in results)
        return None, round(max_sim, 4)

    docs = [doc for doc, _ in filtered]
    max_sim = max(sim for _, sim in filtered)
    return docs, round(max_sim, 4)

# Answer Question
def answer_question(session_id: str, question: str) -> dict:
    if session_id not in sessions:
        return {
            "answer": "Session not found. Please upload a document first.",
            "similarity_score": 0.0,
            "is_in_scope": False
        }

    session = sessions[session_id]
    faiss_index = session["index"]
    chat_history = session["chat_history"]

    # Retrieve
    docs, max_sim = retrieve_with_threshold(faiss_index, question)

    # Out of scope
    if docs is None:
        answer = "I don't have that information in the source documents."
        session["chat_history"].append(HumanMessage(content=question))
        session["chat_history"].append(AIMessage(content=answer))
        return {
            "answer": answer,
            "similarity_score": max_sim,
            "is_in_scope": False
        }

    # Build context
    context = "\n\n".join([doc.page_content for doc in docs])

    # Build chain
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT.format(context=context)),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}")
    ])

    chain = prompt | llm | StrOutputParser()

    response = chain.invoke({
        "input": question,
        "chat_history": chat_history
    })

    # Update history
    session["chat_history"].append(HumanMessage(content=question))
    session["chat_history"].append(AIMessage(content=response))

    return {
        "answer": response,
        "similarity_score": max_sim,
        "is_in_scope": True
    }

# Reset Session
def reset_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]