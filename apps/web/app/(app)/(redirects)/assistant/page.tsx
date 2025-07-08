import { redirectToEmailAccountPath } from "@/utils/account";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{
    threadId?: string;
    [key: string]: string | undefined;
  }>;
}) {
  const params = await searchParams;

  // Filter out undefined values and pass through all search parameters
  const validParams: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      validParams[key] = value;
    }
  });

  await redirectToEmailAccountPath("/assistant", validParams);
}
