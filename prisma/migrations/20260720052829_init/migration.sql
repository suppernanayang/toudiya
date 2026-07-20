-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "target_roles" JSONB,
    "target_industries" JSONB,
    "target_cities" JSONB,
    "salary_expectation" TEXT,
    "work_preference" TEXT,
    "blacklist_companies" JSONB,
    "default_language" TEXT NOT NULL DEFAULT 'zh-CN',
    "privacy_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "llm_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "default_provider" TEXT NOT NULL DEFAULT 'deepseek',
    "default_model" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "fallback_provider" TEXT NOT NULL DEFAULT 'openai',
    "fallback_model" TEXT NOT NULL DEFAULT 'gpt-4.1',
    "auto_fallback" BOOLEAN NOT NULL DEFAULT true,
    "task_model_map" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "llm_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resume_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "target_role_type" TEXT,
    "tags" JSONB,
    "original_file_path" TEXT,
    "parsed_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "resume_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "resume_source_id" TEXT NOT NULL,
    "parent_version_id" TEXT,
    "job_id" TEXT,
    "version_name" TEXT NOT NULL,
    "version_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "file_path" TEXT,
    "file_format" TEXT,
    "content_text" TEXT,
    "change_summary" JSONB,
    "risk_notes" JSONB,
    "pending_confirmations" JSONB,
    "created_by" TEXT NOT NULL DEFAULT 'user',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "resume_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resume_versions_resume_source_id_fkey" FOREIGN KEY ("resume_source_id") REFERENCES "resume_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resume_versions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "resume_versions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "resume_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experience_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "resume_source_id" TEXT,
    "experience_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "role" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "summary" TEXT,
    "tags" JSONB,
    "skills" JSONB,
    "metrics" JSONB,
    "evidence_status" TEXT NOT NULL DEFAULT 'needs_confirmation',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "experience_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experience_items_resume_source_id_fkey" FOREIGN KEY ("resume_source_id") REFERENCES "resume_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "experience_details" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experience_item_id" TEXT NOT NULL,
    "background" TEXT,
    "task" TEXT,
    "actions" TEXT,
    "result" TEXT,
    "data_points" JSONB,
    "challenges" TEXT,
    "reflection" TEXT,
    "interview_questions" JSONB,
    "answer_drafts" JSONB,
    "risk_notes" JSONB,
    "pending_questions" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "experience_details_experience_item_id_fkey" FOREIGN KEY ("experience_item_id") REFERENCES "experience_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_name" TEXT,
    "url" TEXT,
    "city" TEXT,
    "work_mode" TEXT,
    "salary_range" TEXT,
    "jd_raw_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'imported',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "import_batch_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "role_type" TEXT,
    "summary" TEXT,
    "responsibilities" JSONB,
    "hard_requirements" JSONB,
    "nice_to_have" JSONB,
    "keywords" JSONB,
    "experience_years" TEXT,
    "education_requirements" TEXT,
    "risk_flags" JSONB,
    "interview_focus" JSONB,
    "model_provider" TEXT,
    "model_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "job_analyses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resume_job_matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "resume_version_id" TEXT NOT NULL,
    "match_score" INTEGER,
    "match_reasons" JSONB,
    "missing_keywords" JSONB,
    "recommended_changes" JSONB,
    "recommended_action" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "resume_job_matches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resume_job_matches_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "review_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "review_session_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "recommended_resume_version_id" TEXT,
    "ai_draft_resume_version_id" TEXT,
    "current_selected_resume_version_id" TEXT,
    "final_resume_version_id" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'undecided',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "application_message" TEXT,
    "email_body" TEXT,
    "notes" TEXT,
    "risk_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "review_items_review_session_id_fkey" FOREIGN KEY ("review_session_id") REFERENCES "review_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "review_items_recommended_resume_version_id_fkey" FOREIGN KEY ("recommended_resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "review_items_ai_draft_resume_version_id_fkey" FOREIGN KEY ("ai_draft_resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "review_items_current_selected_resume_version_id_fkey" FOREIGN KEY ("current_selected_resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "review_items_final_resume_version_id_fkey" FOREIGN KEY ("final_resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "review_item_id" TEXT,
    "final_resume_version_id" TEXT NOT NULL,
    "application_message" TEXT,
    "email_body" TEXT,
    "attachments" JSONB,
    "submission_method" TEXT NOT NULL DEFAULT 'manual',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "application_packages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "application_packages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "application_packages_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "review_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "application_packages_final_resume_version_id_fkey" FOREIGN KEY ("final_resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "application_package_id" TEXT NOT NULL,
    "submitted_at" DATETIME,
    "current_status" TEXT NOT NULL DEFAULT 'waiting',
    "next_action" TEXT,
    "next_action_at" DATETIME,
    "feedback" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_application_package_id_fkey" FOREIGN KEY ("application_package_id") REFERENCES "application_packages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "interview_preparations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "application_id" TEXT,
    "resume_version_id" TEXT NOT NULL,
    "self_intro" TEXT,
    "key_experience_brief" JSONB,
    "likely_questions" JSONB,
    "star_answers" JSONB,
    "business_questions" JSONB,
    "skills_to_review" JSONB,
    "questions_to_ask" JSONB,
    "risk_notes" JSONB,
    "model_provider" TEXT,
    "model_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "interview_preparations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_preparations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_preparations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "interview_preparations_resume_version_id_fkey" FOREIGN KEY ("resume_version_id") REFERENCES "resume_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "llm_settings_user_id_key" ON "llm_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "experience_details_experience_item_id_key" ON "experience_details"("experience_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_analyses_job_id_key" ON "job_analyses"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_packages_review_item_id_key" ON "application_packages"("review_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_package_id_key" ON "applications"("application_package_id");
