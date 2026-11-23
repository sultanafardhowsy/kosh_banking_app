-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'LOGGED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_QUEUE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "toAddress" TEXT NOT NULL,
    "originalTo" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "notificationType" "NotificationType",
    "status" "EmailStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE INDEX "email_logs_userId_createdAt_idx" ON "email_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

