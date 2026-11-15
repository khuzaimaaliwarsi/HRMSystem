-- CreateTable
CREATE TABLE "candidate_notes" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "content" TEXT NOT NULL,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_notes_candidateId_idx" ON "candidate_notes"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_notes_authorId_idx" ON "candidate_notes"("authorId");

-- CreateIndex
CREATE INDEX "candidate_notes_candidateId_isConfidential_idx" ON "candidate_notes"("candidateId", "isConfidential");

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

