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
import { useThread } from "@/hooks/useThread";
import { runRulesAction } from "@/utils/actions/ai-rule";
import { useState, useEffect, useCallback } from "react";
import { toastError } from "@/components/Toast";
import {
  RuleMismatch,
  getFixMessage,
} from "@/app/(app)/[emailAccountId]/assistant/common";

export function AssistantFixWithChat({
  setInput,
}: {
  setInput: SetInputFunction;
}) {
  const [threadId] = useQueryState("threadId");
  const {
    data: threadData,
    isLoading: threadLoading,
    error: threadError,
  } = useThread({ id: threadId || "" }, { includeDrafts: false });
  const {
    data: rules,
    isLoading: rulesLoading,
    error: rulesError,
  } = useRules();
  const { emailAccountId } = useAccount();
  const { isModalOpen, setIsModalOpen } = useModal();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RunRulesResult | null>(null);

  // Get the latest message from the thread
  const latestMessage = threadData?.thread?.messages?.[0];

  const isLoading = threadLoading || rulesLoading;
  const error = threadError || rulesError;

  const handleRunRules = useCallback(async () => {
    if (!latestMessage || !threadId) return;

    setIsRunning(true);
    try {
      const result = await runRulesAction(emailAccountId, {
        messageId: latestMessage.id,
        threadId: threadId,
        isTest: true,
      });

      if (result?.serverError) {
        toastError({
          title: "There was an error processing the email",
          description: result.serverError,
        });
      } else if (result?.data) {
        setResult(result.data);
      }
    } catch (error) {
      toastError({
        title: "Failed to process email",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  }, [latestMessage, threadId, emailAccountId]);

  // Auto-open modal when threadId is present and thread data is loaded
  useEffect(() => {
    if (threadId && threadData && !isLoading && !error) {
      setIsModalOpen(true);
      // Auto-run rules when modal opens
      handleRunRules();
    }
  }, [threadId, threadData, isLoading, error, handleRunRules]);

  // Don't show the button if there's no threadId
  if (!threadId) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunRules}
          loading={isRunning}
        >
          <MessageCircleIcon className="mr-2 size-4" />
          Fix Rules
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Improve Rules</DialogTitle>
        </DialogHeader>

        <LoadingContent loading={isLoading} error={error}>
          {latestMessage && rules && (
            <RuleMismatch
              emailAccountId={emailAccountId}
              result={result}
              rules={rules}
              onSelectExpectedRuleId={(expectedRuleId) => {
                let input: string;

                if (expectedRuleId === NEW_RULE_ID) {
                  input = getFixMessage({
                    message: latestMessage,
                    result,
                    expectedRuleName: NEW_RULE_ID,
                  });
                } else {
                  const expectedRule = rules.find(
                    (rule) => rule.id === expectedRuleId,
                  );

                  input = getFixMessage({
                    message: latestMessage,
                    result,
                    expectedRuleName: expectedRule?.name ?? null,
                  });
                }

                if (setInput) {
                  setInput(input);
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
