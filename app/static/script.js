
"use strict";

/*
 * IMPORTANT:
 * Change API_ENDPOINT to the actual route defined by your backend.
 * Example Flask route: "/match"
 * Example Django route: "/api/match/"
 */
const API_ENDPOINT = "/match";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

const form = document.getElementById("matchForm");
const resumeInput = document.getElementById("resume");
const jobInput = document.getElementById("job");
const uploadZone = document.getElementById("uploadZone");
const uploadTitle = document.getElementById("uploadTitle");
const fileInfo = document.getElementById("fileInfo");
const charCount = document.getElementById("charCount");
const matchBtn = document.getElementById("matchBtn");
const buttonText = document.getElementById("buttonText");
const statusBox = document.getElementById("status");
const resultSection = document.getElementById("result");
const resultContent = document.getElementById("resultContent");
const resultSummary = document.getElementById("resultSummary");
const resetBtn = document.getElementById("resetBtn");

let isSubmitting = false;

function getFileError(file) {
  if (!file) {
    return "Please select a resume first.";
  }

  const fileName = file.name.toLowerCase();
  const validExtension = ALLOWED_EXTENSIONS.some(
    extension => fileName.endsWith(extension)
  );

  if (!validExtension) {
    return "Unsupported file format. Please upload a PDF, DOCX, or TXT file.";
  }

  if (file.size === 0) {
    return "The selected file is empty. Please choose another file.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "The file exceeds 10 MB. Please choose a smaller resume.";
  }

  return "";
}

function showStatus(message, type = "info") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
  statusBox.hidden = false;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
  statusBox.hidden = true;
}

function updateFileDisplay() {
  const file = resumeInput.files[0];

  if (!file) {
    uploadTitle.textContent = "Choose a file to upload";
    fileInfo.textContent = "Your resume will be used for this analysis.";
    uploadZone.classList.remove("has-file");
    return;
  }

  const error = getFileError(file);

  uploadTitle.textContent = file.name;
  fileInfo.textContent = error
    ? error
    : `${(file.size / 1024).toFixed(1)} KB · Ready to analyze`;

  uploadZone.classList.toggle("has-file", !error);
}

function updateCharacterCount() {
  charCount.textContent =
    `${jobInput.value.length.toLocaleString()} / 20,000`;
}

function setLoading(loading) {
  isSubmitting = loading;
  matchBtn.disabled = loading;
  resumeInput.disabled = loading;
  jobInput.disabled = loading;

  buttonText.textContent = loading
    ? "Analyzing resume..."
    : "Analyze my resume";
}

function addElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function addCard(title, content, options = {}) {
  const card = addElement(
    "article",
    `result-card${options.wide ? " wide" : ""}`
  );

  card.appendChild(addElement("h3", "", title));

  if (typeof content === "string" || typeof content === "number") {
    card.appendChild(addElement("p", "result-text", content));
  } else if (content instanceof Node) {
    card.appendChild(content);
  }

  resultContent.appendChild(card);
  return card;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter(
      item => typeof item === "string" || typeof item === "number"
    );
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function addSkillCard(title, values, missing = false) {
  const card = addElement("article", "result-card");
  card.appendChild(addElement("h3", "", title));

  if (values.length === 0) {
    card.appendChild(
      addElement("p", "", "No details were provided for this section.")
    );
  } else {
    const list = addElement("div", "skill-list");

    values.forEach(value => {
      list.appendChild(
        addElement(
          "span",
          `skill-tag${missing ? " missing" : ""}`,
          value
        )
      );
    });

    card.appendChild(list);
  }

  resultContent.appendChild(card);
}

function addListCard(title, values) {
  const card = addElement("article", "result-card wide");
  card.appendChild(addElement("h3", "", title));

  if (values.length === 0) {
    card.appendChild(
      addElement("p", "", "No suggestions were returned by the backend.")
    );
  } else {
    const list = addElement("ul", "result-list");

    values.forEach(value => {
      list.appendChild(addElement("li", "", value));
    });

    card.appendChild(list);
  }

  resultContent.appendChild(card);
}

function getScore(data) {
  // Adapt these aliases to the field your backend actually returns.
  const candidates = [
    data.match_score,
    data.match_percentage,
    data.similarity_score,
    data.ats_score
  ];

  for (const candidate of candidates) {
    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== "" &&
      Number.isFinite(Number(candidate))
    ) {
      const score = Number(candidate);

      // Similarity scores are sometimes returned between 0 and 1.
      // Percentage-based scores should normally be between 0 and 100.
      if (score >= 0 && score <= 1) {
        return score * 100;
      }

      if (score > 1 && score <= 100) {
        return score;
      }
    }
  }

  return null;
}

function renderResults(data) {
  resultContent.replaceChildren();

  const score = getScore(data);

  if (score !== null) {
    const scoreCard = addElement("article", "result-card wide");
    scoreCard.appendChild(addElement("h3", "", "Overall match score"));

    const layout = addElement("div", "score-layout");
    const ring = addElement("div", "score-ring");
    ring.style.setProperty("--score", String(score));

    ring.appendChild(
      addElement("span", "score-value", `${Math.round(score)}%`)
    );

    layout.appendChild(ring);

    const details = document.createElement("div");
    details.appendChild(
      addElement("p", "", "Resume-to-job-description similarity")
    );
    details.appendChild(
      addElement(
        "p",
        "score-caption",
        "Use this score as a guide, not a guarantee of ATS performance."
      )
    );

    layout.appendChild(details);
    scoreCard.appendChild(layout);
    resultContent.appendChild(scoreCard);
  }

  const matched = normalizeList(
    data.matched_skills ?? data.matching_skills ?? data.matched_keywords
  );

  const missing = normalizeList(
    data.missing_skills ?? data.missing_keywords ?? data.skill_gaps
  );

  const suggestions = normalizeList(
    data.suggestions ?? data.recommendations ?? data.improvements
  );

  if (matched.length) {
    addSkillCard("Matched skills", matched);
  }

  if (missing.length) {
    addSkillCard("Skills to improve", missing, true);
  }

  if (suggestions.length) {
    addListCard("Recommendations", suggestions);
  }

  // Render additional backend fields without assuming their existence.
  const knownKeys = new Set([
    "match_score",
    "match_percentage",
    "similarity_score",
    "ats_score",
    "matched_skills",
    "matching_skills",
    "matched_keywords",
    "missing_skills",
    "missing_keywords",
    "skill_gaps",
    "suggestions",
    "recommendations",
    "improvements",
    "success",
    "message",
    "error"
  ]);

  const summary = data.summary ?? data.analysis ?? data.explanation;

  if (typeof summary === "string" && summary.trim()) {
    addCard("Analysis summary", summary, { wide: true });
  }

  const extraEntries = Object.entries(data).filter(
    ([key, value]) =>
      !knownKeys.has(key) &&
      value !== null &&
      value !== undefined &&
      (typeof value === "string" || typeof value === "number")
  );

  extraEntries.forEach(([key, value]) => {
    const title = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());

    addCard(title, value, { wide: true });
  });

  if (resultContent.children.length === 0) {
    addCard(
      "Backend response",
      "The request completed, but no recognized results were returned. Check the API response format.",
      { wide: true }
    );
  }

  resultSummary.textContent = score === null
    ? "Your analysis was returned. Review the available findings below."
    : "Review your matching score, relevant skills, and improvement areas.";

  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

resumeInput.addEventListener("change", () => {
  clearStatus();
  updateFileDisplay();

  const error = getFileError(resumeInput.files[0]);

  if (error) {
    showStatus(error, "error");
  }
});

jobInput.addEventListener("input", updateCharacterCount);

["dragenter", "dragover"].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach(eventName => {
  uploadZone.addEventListener(eventName, event => {
    event.preventDefault();
    uploadZone.classList.remove("dragging");
  });
});

uploadZone.addEventListener("drop", event => {
  if (isSubmitting) return;

  const file = event.dataTransfer?.files?.[0];

  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  resumeInput.files = transfer.files;

  updateFileDisplay();
  clearStatus();

  const error = getFileError(file);

  if (error) {
    showStatus(error, "error");
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmitting) return;

  clearStatus();

  const file = resumeInput.files[0];
  const jobDescription = jobInput.value.trim();
  const fileError = getFileError(file);

  if (fileError) {
    showStatus(fileError, "error");
    resumeInput.focus();
    return;
  }

  if (jobDescription.length < 20) {
    showStatus(
      "Please enter a more detailed job description (at least 20 characters).",
      "error"
    );
    jobInput.focus();
    return;
  }

  if (jobDescription.length > 20000) {
    showStatus("The job description is too long.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("resume", file);
  formData.append("job_description", jobDescription);

  setLoading(true);
  showStatus(
    "Analyzing your resume against the job description. This may take a moment.",
    "info"
  );

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const body = await response.text();

      if (response.status === 404) {
        throw new Error(
          `API endpoint not found: ${API_ENDPOINT}. Update API_ENDPOINT in script.js to match your Python route.`
        );
      }

      if (response.status === 405) {
        throw new Error(
          "The backend does not accept POST requests at this endpoint. Check your route configuration."
        );
      }

      if (response.status === 413) {
        throw new Error("The server rejected the upload because it is too large.");
      }

      if (response.status === 403) {
        throw new Error(
          "Request forbidden. If using Django, check CSRF protection and authentication."
        );
      }

      throw new Error(
        `Expected a JSON response but received another format (HTTP ${response.status}). Check the backend route and server logs. ${body.slice(0, 120)}`
      );
    }

    const data = await response.json();

    if (!response.ok || data.success === false || data.error) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : typeof data.message === "string"
            ? data.message
            : `Analysis failed (HTTP ${response.status}).`
      );
    }

    renderResults(data);
    showStatus("Analysis completed successfully.", "success");
  } catch (error) {
    console.error("Resume matching error:", error);

    showStatus(
      error instanceof TypeError
        ? "Could not connect to the backend. Check that your Python server is running and the endpoint is correct."
        : error.message || "Something went wrong while analyzing your resume.",
      "error"
    );
  } finally {
    setLoading(false);
  }
});

resetBtn.addEventListener("click", () => {
  form.reset();
  resultContent.replaceChildren();
  resultSection.hidden = true;
  clearStatus();
  updateFileDisplay();
  updateCharacterCount();

  window.scrollTo({ top: 0, behavior: "smooth" });
});

updateFileDisplay();
updateCharacterCount();
