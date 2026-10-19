# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "tokenizers"]
# ///
"""Builds src/content/retrieval.json, the data behind the retrieval scene at the top of the site.

Embeds every note in scripts/notes.json (with a one-line context header) and the question with a
local model through Ollama, ranks the notes by cosine similarity, and squashes all the vectors
down to 2D with PCA so they can be drawn on a canvas. The question's tokens come from the same
model's tokenizer. The tokens, numbers and scores on the site are the real ones from this run.

    ollama pull qwen3-embedding:0.6b
    uv run scripts/embed_notes.py
"""

import json
import urllib.request
from pathlib import Path

import numpy as np
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent.parent
OLLAMA = "http://localhost:11434/api/embed"
MODEL = "qwen3-embedding:0.6b"
# The same model on Hugging Face, for its tokenizer. Ollama doesn't expose token IDs.
TOKENIZER = "Qwen/Qwen3-Embedding-0.6B"
QUESTION = "Who is Rama Raihan?"
TOP_K = 5
VECTOR_HEAD = 12  # how many of the query's numbers the page shows

# Qwen3-Embedding wants an instruction on the query side only.
QUERY_PROMPT = (
    "Instruct: Given a question about a person, retrieve notes that describe who they are "
    "and what they do\n"
    f"Query: {QUESTION}"
)


def with_context(note: dict) -> str:
    # Most notes never say whose they are ("I deploy my own apps..."). A short header that
    # names the author and the file keeps them findable for a question about me.
    return f"From Rama Raihan's notes, {note['source']}: {note['text']}"


def embed(texts: list[str]) -> np.ndarray:
    body = json.dumps({"model": MODEL, "input": texts}).encode()
    req = urllib.request.Request(OLLAMA, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as res:
        vectors = np.array(json.load(res)["embeddings"], dtype=np.float64)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def main() -> None:
    notes = json.loads((ROOT / "scripts/notes.json").read_text(encoding="utf-8"))
    docs = embed([with_context(n) for n in notes])
    query = embed([QUERY_PROMPT])[0]

    scores = docs @ query
    top = np.argsort(-scores)[:TOP_K]

    # PCA on the notes, then the question goes through the same projection.
    mean = docs.mean(axis=0)
    _, _, vt = np.linalg.svd(docs - mean, full_matrices=False)
    axes = vt[:2].T
    flat = (docs - mean) @ axes
    q2 = (query - mean) @ axes
    scale = np.abs(flat).max()
    flat, q2 = flat / scale, q2 / scale

    tok = Tokenizer.from_pretrained(TOKENIZER)
    ids = tok.encode(QUESTION, add_special_tokens=False).ids
    tokens = [{"text": tok.decode([i]), "id": i} for i in ids]

    out = {
        "question": QUESTION,
        "model": MODEL,
        "tokenizer": TOKENIZER,
        "dims": int(docs.shape[1]),
        "tokens": tokens,
        "queryHead": [round(float(v), 4) for v in query[:VECTOR_HEAD]],
        "query": {"x": round(float(q2[0]), 4), "y": round(float(q2[1]), 4)},
        "points": [
            {
                "x": round(float(flat[i, 0]), 4),
                "y": round(float(flat[i, 1]), 4),
                "group": n["group"],
                "source": n["source"],
                "text": n["text"],
            }
            for i, n in enumerate(notes)
        ],
        "top": [{"index": int(i), "score": round(float(scores[i]), 3)} for i in top],
    }

    target = ROOT / "src/content/retrieval.json"
    target.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"{len(notes)} notes, {out['dims']} dims -> {target.relative_to(ROOT)}")
    for rank, i in enumerate(top, 1):
        print(f"  {rank}. {scores[i]:.3f}  {notes[i]['source']:<22} {notes[i]['text'][:70]}")


if __name__ == "__main__":
    main()
