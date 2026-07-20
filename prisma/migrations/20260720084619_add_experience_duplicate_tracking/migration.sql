-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_experience_items" (
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
    "duplicate_of_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "experience_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "experience_items_resume_source_id_fkey" FOREIGN KEY ("resume_source_id") REFERENCES "resume_sources" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "experience_items_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "experience_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_experience_items" ("created_at", "end_date", "evidence_status", "experience_type", "id", "metrics", "organization", "resume_source_id", "role", "skills", "start_date", "summary", "tags", "title", "updated_at", "user_id") SELECT "created_at", "end_date", "evidence_status", "experience_type", "id", "metrics", "organization", "resume_source_id", "role", "skills", "start_date", "summary", "tags", "title", "updated_at", "user_id" FROM "experience_items";
DROP TABLE "experience_items";
ALTER TABLE "new_experience_items" RENAME TO "experience_items";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
