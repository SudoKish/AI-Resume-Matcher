
import os
from ollama import Client

# Local development uses localhost.
# Production must set OLLAMA_BASE_URL to a reachable Ollama server.
OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://127.0.0.1:11434",
).rstrip("/")

MODEL_NAME = os.getenv(
    "OLLAMA_MODEL",
    "llama3.2:3b",
)

client = Client(
    host=OLLAMA_BASE_URL,
    timeout=20,
)


def generate_ai_explanation(
    match_score,
    resume_skills,
    missing_skills,
    job_keywords,
):
    fallback = (
        f"Your resume has a calculated match score of {match_score}%. "
        f"Skills found: {', '.join(resume_skills[:5]) or 'None'}. "
        f"Missing skills: {', '.join(missing_skills[:5]) or 'None'}. "
        "Review the job requirements and improve your resume with "
        "relevant skills and experience you genuinely possess."
    )

    try:
        response = client.chat(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an AI resume analysis assistant. "
                        "Explain matching results in simple, professional "
                        "language. Never invent qualifications. "
                        "Keep the response concise."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Resume match score: {match_score}%\n"
                        f"Resume skills: {', '.join(resume_skills[:10])}\n"
                        f"Missing skills: {', '.join(missing_skills[:10])}\n"
                        f"Job keywords: {', '.join(job_keywords[:10])}\n\n"
                        "Explain the candidate's strengths and give "
                        "three practical suggestions for improving "
                        "the resume."
                    ),
                },
            ],
            options={
                "temperature": 0.3,
                "num_predict": 150,
            },
        )

        explanation = response.message.content

        if explanation and explanation.strip():
            return explanation.strip()

    except Exception as error:
        # Log the failure without exposing it to the end user.
        print(f"Ollama error: {type(error).__name__}: {error}")

    return fallback
