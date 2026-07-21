-- CreateTable
CREATE TABLE "extension_pairings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "last_seen_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "extension_pairings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_pairings_user_id_key" ON "extension_pairings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "extension_pairings_token_key" ON "extension_pairings"("token");
