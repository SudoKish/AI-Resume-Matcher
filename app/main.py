
import os
import tempfile
import shutil

from pathlib import Path

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.utils import (
    extract_text_from_file,
    clean_text,
    get_tfidf_similarity,
    extract_keywords,
    match_skills_from_list,
)
from app.llm import generate_ai_explanation


app = FastAPI(title="AI Resume Matcher")

# Resolve templates and static files relative to this file
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATE_DIR = BASE_DIR / "templates"

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)

templates = Jinja2Templates(
    directory=str(TEMPLATE_DIR)
)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#",
    "react", "angular", "vue", "node", "express",
    "fastapi", "django", "flask", "html", "css",
    "tailwind", "bootstrap", "sql", "mysql", "postgresql",
    "mongodb", "aws", "azure", "gcp", "docker",
    "kubernetes", "git", "github", "api", "rest", "linux",
]


@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request},
    )


@app.post("/match")
async def match_resume(
    job_description: str = Form(...),
    resume: UploadFile = File(...),
):
    if not resume.filename:
        raise HTTPException(
            status_code=400,
            detail="Please upload a resume.",
        )

    extension = Path(resume.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a PDF, DOCX, or TXT file.",
        )

    file_path = None

    try:
        # Use the operating system's temporary directory.
        # On Vercel this is normally /tmp.
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=extension,
            delete=False,
        ) as temp_file:
            file_path = temp_file.name
            shutil.copyfileobj(resume.file, temp_file)

        resume_raw = extract_text_from_file(
            file_path,
            resume.filename,
        )

        resume_text = clean_text(resume_raw)
        job_text = clean_text(job_description)

        if not resume_text or not job_text:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not extract text from the resume "
                    "or job description."
                ),
            )

        # Calculate text similarity
        similarity = get_tfidf_similarity(
            resume_text,
            job_text,
        )

        # Identify relevant skills
        resume_skills = match_skills_from_list(
            resume_text, SKILLS
        )
        job_skills = match_skills_from_list(
            job_text, SKILLS
        )

        missing_skills = [
            skill
            for skill in job_skills
            if skill not in resume_skills
        ]

        skill_score = (
            len(job_skills) - len(missing_skills)
        ) / len(job_skills) if job_skills else 0

        final_score = round(
            (0.6 * similarity + 0.4 * skill_score) * 100,
            2,
        )

        # Extract important keywords
        resume_keywords = extract_keywords(resume_text)
        job_keywords = extract_keywords(job_text)

        # Build ATS suggestions
        suggestions = []

        if missing_skills:
            suggestions.append(
                "Review these missing skills: "
                + ", ".join(missing_skills[:5])
            )

        if final_score < 50:
            suggestions.append(
                "Improve keyword alignment with the job description."
            )

        if (
            "experience" not in resume_text
            and "projects" not in resume_text
        ):
            suggestions.append(
                "Consider adding an Experience or Projects section."
            )

        if not suggestions:
            suggestions.append(
                "Your resume appears well aligned with the job description."
            )

        # AI explanations are optional: matching should still work
        # when the configured LLM service is unavailable.
        try:
            ai_explanation = generate_ai_explanation(
                match_score=final_score,
                resume_skills=resume_skills,
                missing_skills=missing_skills,
                job_keywords=job_keywords,
            )
        except Exception:
            ai_explanation = (
                "AI explanation is temporarily unavailable. "
                "Your resume matching results are ready."
            )

        return {
            "match_score": final_score,
            "resume_keywords": resume_keywords,
            "job_keywords": job_keywords,
            "skills_found_in_resume": resume_skills,
            "skills_required_in_job": job_skills,
            "missing_skills": missing_skills,
            "ats_suggestions": suggestions,
            "ai_explanation": ai_explanation,
        }

    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        await resume.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", reload=True)
