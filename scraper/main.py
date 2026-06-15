from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from search import search_company

app = FastAPI(title="Company Domain Scraper", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str

class BatchSearchRequest(BaseModel):
    queries: list[str]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/scrape/company")
def scrape_company(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")
    result = search_company(req.query.strip())
    if not result.get('domain'):
        raise HTTPException(404, f"No domain found for '{req.query}'")
    return result

@app.post("/scrape/batch")
def scrape_batch(req: BatchSearchRequest):
    if not req.queries:
        raise HTTPException(400, "Queries cannot be empty")
    if len(req.queries) > 50:
        raise HTTPException(400, "Max 50 queries per request")

    results = []
    for q in req.queries:
        try:
            r = search_company(q.strip())
            results.append(r)
        except Exception as e:
            results.append({'query': q, 'name': '', 'domain': '', 'url': '', 'snippet': '', 'source': 'none', 'error': str(e)})

    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8766)
