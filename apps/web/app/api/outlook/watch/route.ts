import { NextResponse } from "next/server";
import { watchEmails } from "./controller";
import { withAuth } from "@/utils/middleware";
import { createScopedLogger } from "@/utils/logger";
import prisma from "@/utils/prisma";
import { getOutlookClientWithRefresh } from "@/utils/outlook/client";

export const dynamic = "force-dynamic";

const logger = createScopedLogger("api/outlook/watch");

export const GET = withAuth(async (request) => {
  const userId = request.auth.userId;
  const results = [];

  // First get all Microsoft accounts for this user
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "microsoft-entra-id",
    },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      emailAccount: {
        select: {
          id: true,
        },
      },
    },
  });

  if (accounts.length === 0) {
    return NextResponse.json(
      { message: "No Microsoft email accounts found for this user." },
      { status: 404 },
    );
  }

  for (const account of accounts) {
    if (!account.emailAccount) continue;

    try {
      const client = await getOutlookClientWithRefresh({
        accessToken: account.access_token || null,
        refreshToken: account.refresh_token || null,
        expiresAt: account.expires_at || null,
        emailAccountId: account.emailAccount.id,
      });

      const expirationDate = await watchEmails({
        emailAccountId: account.emailAccount.id,
        client: client.getClient(),
      });

      if (expirationDate) {
        results.push({
          emailAccountId: account.emailAccount.id,
          status: "success",
          expirationDate,
        });
      } else {
        logger.error("Error watching inbox for account", {
          emailAccountId: account.emailAccount.id,
        });
        results.push({
          emailAccountId: account.emailAccount.id,
          status: "error",
          message: "Failed to set up watch for this account.",
        });
      }
    } catch (error) {
      logger.error("Exception while watching inbox for account", {
        emailAccountId: account.emailAccount.id,
        error,
      });
      results.push({
        emailAccountId: account.emailAccount.id,
        status: "error",
        message:
          "An unexpected error occurred while setting up watch for this account.",
        errorDetails: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ results });
});
