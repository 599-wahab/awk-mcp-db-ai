// app/api/register/route.ts
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: Request) {
  try {
    const { name, email, password, databaseUrl, geminiKey, aiProvider, aiModel, aiBaseUrl } = await req.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashed,
        role: "USER",
      },
    });

    let apiKey = null;
    let appId = null;

    // If databaseUrl is provided, create a ConnectedApp for this user
    if (databaseUrl) {
      const finalDbUrl = databaseUrl || process.env.DEFAULT_DATABASE_URL;
      if (!finalDbUrl) {
        // Rollback user creation
        await prisma.user.delete({ where: { id: user.id } });
        return Response.json({ error: "No database URL provided and no default set" }, { status: 400 });
      }

      const newApiKey = generateApiKey();
      const app = await prisma.connectedApp.create({
        data: {
          apiKey: newApiKey,
          name: `${name || email}'s ERP`,
          isActive: true,
          dbUrl: finalDbUrl,
          geminiKey: geminiKey || null,
          aiProvider: aiProvider || 'GEMINI',
          aiModel: aiModel || null,
          aiBaseUrl: aiBaseUrl || null,
          totalChats: 0,
          lastActiveAt: new Date(),
          userId: user.id,
        },
      });
      apiKey = app.apiKey;
      appId = app.id;

      // Trigger async schema fetch
      import("@/lib/memory/schema-loader").then(({ getAppSchema }) => {
        getAppSchema(app.id).catch(console.error);
      });
    }

    return Response.json({
      id: user.id,
      email: user.email,
      apiKey,
      appId,
      message: apiKey
        ? "Account created with database connection. Save your API key."
        : "Account created. Please connect your database in settings to get an API key.",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Registration error:", error);
    return Response.json({ error: error.message || "Registration failed" }, { status: 500 });
  }
}