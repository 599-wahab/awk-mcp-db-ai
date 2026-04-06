-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('GEMINI', 'OPENAI', 'ANTHROPIC', 'LMSTUDIO', 'OLLAMA');

-- CreateEnum
CREATE TYPE "DbType" AS ENUM ('POSTGRESQL', 'MYSQL', 'SQLITE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "connected_apps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "origin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dbUrl" TEXT,
    "dbType" "DbType" NOT NULL DEFAULT 'POSTGRESQL',
    "geminiKey" TEXT,
    "schemaJson" TEXT,
    "schemaBuiltAt" TIMESTAMP(3),
    "contextJson" TEXT,
    "totalChats" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aiProvider" "AIProviderType" NOT NULL DEFAULT 'GEMINI',
    "aiModel" TEXT,
    "aiBaseUrl" TEXT,

    CONSTRAINT "connected_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_logs" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "generatedSql" TEXT,
    "result" TEXT,
    "explanation" TEXT,
    "wasSuccessful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "connected_apps_apiKey_key" ON "connected_apps"("apiKey");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_apps" ADD CONSTRAINT "connected_apps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_appId_fkey" FOREIGN KEY ("appId") REFERENCES "connected_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
