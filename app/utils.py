
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from pdfminer.high_level import extract_text
from docx import Document


# Extract text from PDF, DOCX, or TXT files
def extract_text_from_file(path, filename):
    filename = filename.lower()

    try:
        if filename.endswith(".pdf"):
            return extract_text(path) or ""

        elif filename.endswith(".docx"):
            document = Document(path)
            return " ".join(
                paragraph.text for paragraph in document.paragraphs
            )

        elif filename.endswith(".txt"):
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                return file.read()

    except Exception:
        return ""

    return ""


# Clean text before comparing it
def clean_text(text):
    if not text:
        return ""

    text = text.lower()
    text = re.sub(r"http\S+|www\S+|\S+@\S+", " ", text)
    text = re.sub(r"[^a-z0-9+#.\-\s]", " ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# Compare resume and job description
def get_tfidf_similarity(resume_text, job_text):
    vectorizer = TfidfVectorizer(ngram_range=(1, 2))

    try:
        tfidf = vectorizer.fit_transform([
            resume_text,
            job_text
        ])

        similarity = cosine_similarity(
            tfidf[0:1],
            tfidf[1:2]
        )[0][0]

        return float(similarity)

    except ValueError:
        return 0.0


# Extract important keywords
def extract_keywords(text, n=10):
    if not text or not text.strip():
        return []

    vectorizer = TfidfVectorizer(
        max_features=n,
        stop_words="english"
    )

    try:
        vectorizer.fit([text])
        return vectorizer.get_feature_names_out().tolist()

    except ValueError:
        return []


# Find skills from a predefined list
def match_skills_from_list(text, skills):
    if not text:
        return []

    found = []

    for skill in skills:
        pattern = r"(?<!\w)" + re.escape(skill.lower()) + r"(?!\w)"

        if re.search(pattern, text.lower()):
            found.append(skill)

    return sorted(set(found))
