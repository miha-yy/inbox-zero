import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import prisma from "@/utils/prisma";
import { getOutlookClientWithRefresh } from "@/utils/outlook/client";
import { captureException } from "@/utils/error";
import { createScopedLogger } from "@/utils/logger";
import { watchOutlook, unwatchOutlook } from "@/utils/outlook/watch";

const logger = createScopedLogger("outlook/watch");

export async function watchEmails({
  emailAccountId,
  client,
}: {
  emailAccountId: string;
  client: GraphClient;
}) {
  logger.info("Watching emails", { emailAccountId });

  try {
    const res = await watchOutlook(client);

    if (res.expiration) {
      const expirationDate = new Date(res.expiration);
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          watchEmailsExpirationDate: expirationDate,
          lastSyncedHistoryId: res.id, // Using this field to store subscription ID
        },
      });
      return expirationDate;
    }
  } catch (error) {
    logger.error("Error watching inbox", { emailAccountId, error });
    throw error;
  }
}

export async function unwatchEmails({
  emailAccountId,
  accessToken,
  refreshToken,
  expiresAt,
}: {
  emailAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}) {
  try {
    logger.info("Unwatching emails", { emailAccountId });

    // Get the existing subscription ID
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      select: { lastSyncedHistoryId: true },
    });

    if (account?.lastSyncedHistoryId) {
      const client = await getOutlookClientWithRefresh({
        accessToken,
        refreshToken,
        expiresAt,
        emailAccountId,
      });

      await unwatchOutlook(client.getClient(), account.lastSyncedHistoryId);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid_grant")) {
      logger.warn("Error unwatching emails, invalid grant", { emailAccountId });
      return;
    }

    logger.error("Error unwatching emails", { emailAccountId, error });
    captureException(error);
  }

  await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: {
      watchEmailsExpirationDate: null,
      lastSyncedHistoryId: null,
    },
  });
}
