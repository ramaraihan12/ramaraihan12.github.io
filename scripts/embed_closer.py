# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Builds src/content/closer.json, the data behind Closer, the game in the play section.

Embeds every note in scripts/notes.json the same way embed_notes.py does (same context header,
same local model through Ollama, normalised), then embeds a dozen short questions a recruiter or
client might ask and saves the cosine score of every note for every question. The game shows two
notes and the player guesses which one the model scores closer, so these are the real scores.

It also prints a fairness check: each question's top 5 and bottom 3 notes and its score spread,
and how many note pairs fall in each score-gap band, for tuning the game's difficulty.

    ollama pull qwen3-embedding:0.6b
    uv run scripts/embed_closer.py
"""

import json
import urllib.request
from itertools import combinations
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OLLAMA = "http://localhost:11434/api/embed"
MODEL = "qwen3-embedding:0.6b"

# id, question. Short and plain, spread over the note groups so different notes win.
QUESTIONS = [
    ("ship", "Can he ship an app to production?"),
    ("ai", "What has he built with AI?"),
    ("laravel", "Does he work with Laravel?"),
    ("based", "Where is he based?"),
    ("payments", "Can he handle payments?"),
    ("documents", "How does he search inside documents?"),
    ("local", "Does he run models locally?"),
    # "What does he build for fun?" and "What are his side projects?" both topped out on
    # about.md and stack/python, so the side projects get a concrete question instead.
    ("youtube", "Has he built anything for YouTube?"),
    ("databases", "Which databases does he use?"),
    ("remote", "Can he work with a remote team?"),
    ("tests", "How does he test his code?"),
    ("react", "Does he know React?"),
    ("who", "Who is Rama Raihan?"),
]

# Qwen3-Embedding wants an instruction on the query side only.
INSTRUCT = "Instruct: Given a question about a developer, retrieve the notes that answer it\nQuery: {q}"

BANDS = [(0.12, None), (0.07, 0.12), (0.04, 0.07), (0.02, 0.04), (None, 0.02)]


def with_context(note: dict) -> str:
    # Same header as embed_notes.py, so the note vectors match the rest of the site.
    return f"From Rama Raihan's notes, {note['source']}: {note['text']}"


def embed(texts: list[str]) -> np.ndarray:
    body = json.dumps({"model": MODEL, "input": texts}).encode()
    req = urllib.request.Request(OLLAMA, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as res:
        vectors = np.array(json.load(res)["embeddings"], dtype=np.float64)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def band_label(lo: float | None, hi: float | None) -> str:
    if hi is None:
        return f">={lo:.2f}"
    if lo is None:
        return f"<{hi:.2f}"
    return f"{lo:.2f}-{hi:.2f}"


def main() -> None:
    notes = json.loads((ROOT / "scripts/notes.json").read_text(encoding="utf-8"))
    docs = embed([with_context(n) for n in notes])
    queries = embed([INSTRUCT.format(q=text) for _, text in QUESTIONS])
    scores = queries @ docs.T  # one row per question, one column per note
    rounded = np.round(scores, 3)

    out = {
        "model": MODEL,
        "dims": int(docs.shape[1]),
        "questions": [
            {"id": qid, "text": text, "scores": [float(s) for s in rounded[k]]}
            for k, (qid, text) in enumerate(QUESTIONS)
        ],
    }

    # Two-space indent like retrieval.json, but each scores array on one line.
    text = json.dumps(out, indent=2, ensure_ascii=False)
    for q in out["questions"]:
        expanded = json.dumps(q["scores"], indent=2).replace("\n", "\n      ")
        text = text.replace(expanded, json.dumps(q["scores"]), 1)
    target = ROOT / "src/content/closer.json"
    target.write_text(text + "\n", encoding="utf-8")
    print(f"{len(QUESTIONS)} questions x {len(notes)} notes, {out['dims']} dims -> {target.relative_to(ROOT)}")

    def line(i: int, s: float) -> str:
        return f"    {s:.3f}  {notes[i]['source']:<22} {notes[i]['text'][:70]}"

    wins: dict[int, int] = {}
    for k, (qid, text) in enumerate(QUESTIONS):
        row = scores[k]
        order = np.argsort(-row)
        wins[order[0]] = wins.get(order[0], 0) + 1
        print(f"\n[{qid}] {text}  spread {row.max() - row.min():.3f}")
        for i in order[:5]:
            print(line(i, row[i]))
        print("    ...")
        for i in order[-3:]:
            print(line(i, row[i]))

    counts = [0] * len(BANDS)
    for k in range(len(QUESTIONS)):
        for a, b in combinations(rounded[k], 2):
            gap = abs(a - b)
            for j, (lo, hi) in enumerate(BANDS):
                if (lo is None or gap >= lo) and (hi is None or gap < hi):
                    counts[j] += 1
                    break
    print("\nnote pairs by score gap, all questions:")
    for (lo, hi), n in zip(BANDS, counts):
        print(f"    {band_label(lo, hi):<10} {n}")

    print("\ntop note per question:")
    for i, n in sorted(wins.items(), key=lambda kv: -kv[1]):
        print(f"    {n}x  {notes[i]['source']} ({notes[i]['text'][:40]})")

    # Notes that sit near the top or bottom of nearly every question make easy pairs.
    ranks = np.argsort(np.argsort(-scores, axis=1), axis=1)  # 0 = closest
    mean_rank = ranks.mean(axis=0)
    print("\nnotes by mean rank (0 = always closest):")
    for i in np.argsort(mean_rank)[:3].tolist() + np.argsort(mean_rank)[-3:].tolist():
        print(f"    {mean_rank[i]:5.1f}  {notes[i]['source']:<22} {notes[i]['text'][:50]}")


if __name__ == "__main__":
    main()
