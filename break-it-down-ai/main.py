from __future__ import annotations

import asyncio
import os
import re
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")

app = FastAPI(title="Break It Down AI", version="0.1.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["POST"],
        allow_headers=["*"],
    )


class GenerateRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=200)


class GenerateResponse(BaseModel):
    steps: List[str]


def _get_openai_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)


def _normalize_task(task: str) -> str:
    cleaned = re.sub(r"\s+", " ", task.strip())
    return cleaned[:200]


def _parse_steps(text: str) -> List[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    steps: List[str] = []
    for line in lines:
        cleaned = re.sub(r"^(\d+[\).\s-]+|[-*]\s+)", "", line).strip()
        if cleaned:
            steps.append(cleaned)
    return steps


def _fallback_steps(task: str) -> List[str]:
    subject = _normalize_task(task)
    return [
        f"Clarify the desired outcome for: {subject}.",
        "List the key resources or info you need to start.",
        "Complete the first small action and note the next step.",
    ]


def _generate_with_openai(task: str) -> List[str]:
    client = _get_openai_client()
    if not client:
        return _fallback_steps(task)

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))

    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an assistant that returns exactly three short, "
                    "actionable, non-overlapping steps for a top-level task. "
                    "Return each step on its own line as a numbered list."
                ),
            },
            {
                "role": "user",
                "content": f"Task: {task}\nReturn exactly 3 steps.",
            },
        ],
    )

    text = response.choices[0].message.content or ""
    steps = _parse_steps(text)
    if len(steps) < 3:
        return _fallback_steps(task)
    return steps[:3]


@app.post("/generate-steps", response_model=GenerateResponse)
async def generate_steps(payload: GenerateRequest) -> GenerateResponse:
    task = _normalize_task(payload.task)
    if not task:
        raise HTTPException(status_code=400, detail="Task is required.")

    steps = await asyncio.to_thread(_generate_with_openai, task)
    if len(steps) != 3:
        raise HTTPException(status_code=500, detail="Step generation failed.")

    return GenerateResponse(steps=steps)
