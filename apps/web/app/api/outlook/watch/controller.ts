import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import prisma from "@/utils/prisma";
import { getOutlookClientWithRefresh } from "@/utils/outlook/client";
import { captureException } from "@/utils/error";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("outlook/watch");

// Microsoft Graph subscription creation
async function createSubscription(client: GraphClient) {
  const now = new Date();
  const expirationDate = new Date(now.getTime() + 4230 * 60000); // ~2.9 days (max allowed by Microsoft)

  const subscription = await client.api("/subscriptions").post({
    changeType: "created,updated",
    notificationUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/notifications`,
    resource: "/me/messages",
    expirationDateTime: expirationDate.toISOString(),
    clientState: "inbox-zero-subscription",
  });

  return subscription;
}

// Microsoft Graph subscription deletion
async function deleteSubscription(client: GraphClient, subscriptionId: string) {
  await client.api(`/subscriptions/${subscriptionId}`).delete();
}

export async function watchEmails({
  emailAccountId,
  client,
}: {
  emailAccountId: string;
  client: GraphClient;
}) {
  logger.info("Watching emails", { emailAccountId });

  try {
    const subscription = await createSubscription(client);

    if (subscription.expirationDateTime) {
      const expirationDate = new Date(subscription.expirationDateTime);
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: {
          watchEmailsExpirationDate: expirationDate,
          lastSyncedHistoryId: subscription.id, // Using this field to store subscription ID
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

      await deleteSubscription(client.getClient(), account.lastSyncedHistoryId);
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
