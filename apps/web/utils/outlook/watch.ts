import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import { env } from "@/env";

export async function watchOutlook(client: GraphClient) {
  const now = new Date();
  const expirationDate = new Date(now.getTime() + 4230 * 60000); // ~2.9 days (max allowed by Microsoft)

  const subscription = await client.api("/subscriptions").post({
    changeType: "created,updated",
    notificationUrl: `${env.NEXT_PUBLIC_BASE_URL}/api/outlook/notifications`,
    resource: "/me/messages",
    expirationDateTime: expirationDate.toISOString(),
    clientState: "inbox-zero-subscription",
  });

  return {
    id: subscription.id,
    expiration: subscription.expirationDateTime,
  };
}

export async function unwatchOutlook(
  client: GraphClient,
  subscriptionId: string,
) {
  await client.api(`/subscriptions/${subscriptionId}`).delete();
}
