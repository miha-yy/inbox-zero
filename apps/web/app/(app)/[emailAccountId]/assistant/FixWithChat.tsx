import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SetInputFunction } from "@/components/assistant-chat/types";
import type { ParsedMessage } from "@/utils/types";
import type { RunRulesResult } from "@/utils/ai/choose-rule/run-rules";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingContent } from "@/components/LoadingContent";
import { useRules } from "@/hooks/useRules";
import { useAccount } from "@/providers/EmailAccountProvider";
import { useModal } from "@/hooks/useModal";
import { NEW_RULE_ID } from "@/app/(app)/[emailAccountId]/assistant/consts";
import { useAssistantNavigation } from "@/hooks/useAssistantNavigation";
import {
  RuleMismatch,
  getFixMessage,
} from "@/app/(app)/[emailAccountId]/assistant/common";

export function FixWithChat({
  setInput,
  message,
  result,
}: {
  setInput: SetInputFunction;
  message: ParsedMessage;
  result: RunRulesResult | null;
}) {
  const { data, isLoading, error } = useRules();
  const { emailAccountId } = useAccount();
  const { isModalOpen, setIsModalOpen } = useModal();
  const { createAssistantUrl } = useAssistantNavigation(emailAccountId);
  const router = useRouter();
  const [currentTab] = useQueryState("tab");

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircleIcon className="mr-2 size-4" />
          Fix
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Improve Rules</DialogTitle>
        </DialogHeader>

        <LoadingContent loading={isLoading} error={error}>
          {data && (
            <RuleMismatch
              emailAccountId={emailAccountId}
              result={result}
              rules={data}
              onSelectExpectedRuleId={(expectedRuleId) => {
                let input: string;

                if (expectedRuleId === NEW_RULE_ID) {
                  input = getFixMessage({
                    message,
                    result,
                    expectedRuleName: NEW_RULE_ID,
                  });
                } else {
                  const expectedRule = data.find(
                    (rule) => rule.id === expectedRuleId,
                  );

                  input = getFixMessage({
                    message,
                    result,
                    expectedRuleName: expectedRule?.name ?? null,
                  });
                }

                if (setInput) {
                  // this is only set if we're in the correct context
                  setInput(input);
                } else {
                  // redirect to the assistant page
                  router.push(
                    createAssistantUrl({
                      input,
                      tab: currentTab || undefined,
                      path: `/assistant${currentTab ? `?tab=${currentTab}` : ""}`,
                    }),
                  );
                }

                setIsModalOpen(false);
              }}
            />
          )}
        </LoadingContent>
      </DialogContent>
    </Dialog>
  );
}
