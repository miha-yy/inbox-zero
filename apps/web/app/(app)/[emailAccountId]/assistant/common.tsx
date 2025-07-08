import { truncate } from "@/utils/string";
import type { ParsedMessage } from "@/utils/types";
import type { RunRulesResult } from "@/utils/ai/choose-rule/run-rules";
import { NEW_RULE_ID } from "@/app/(app)/[emailAccountId]/assistant/consts";
import { Label } from "@/components/Input";
import { ButtonList } from "@/components/ButtonList";
import type { RulesResponse } from "@/app/api/user/rules/route";
import { ProcessResultDisplay } from "@/app/(app)/[emailAccountId]/assistant/ProcessResultDisplay";
import { NONE_RULE_ID } from "@/app/(app)/[emailAccountId]/assistant/consts";

export function getFixMessage({
  message,
  result,
  expectedRuleName,
}: {
  message: ParsedMessage;
  result: RunRulesResult | null;
  expectedRuleName: string | null;
}) {
  // Truncate content if it's too long
  const getMessageContent = () => {
    const content = message.snippet || message.textPlain || "";
    return truncate(content, 500).trim();
  };

  return `You applied the wrong rule to this email.
Fix our rules so this type of email is handled correctly in the future.

Email details:
*From*: ${message.headers.from}
*Subject*: ${message.headers.subject}
*Content*: ${getMessageContent()}

Current rule applied: ${result?.rule?.name || "No rule"}

Reason the rule was chosen:
${result?.reason || "-"}

${
  expectedRuleName === NEW_RULE_ID
    ? "I'd like to create a new rule to handle this type of email."
    : expectedRuleName
      ? `The rule that should have been applied was: "${expectedRuleName}"`
      : "Instead, no rule should have been applied."
}
`.trim();
}

export function RuleMismatch({
  result,
  rules,
  emailAccountId,
  onSelectExpectedRuleId,
}: {
  result: RunRulesResult | null;
  rules: RulesResponse;
  emailAccountId: string;
  onSelectExpectedRuleId: (ruleId: string | null) => void;
}) {
  return (
    <div>
      <Label name="matchedRule" label="Matched:" />
      <div className="mt-1">
        {result ? (
          <ProcessResultDisplay
            result={result}
            emailAccountId={emailAccountId}
          />
        ) : (
          <p>No rule matched</p>
        )}
      </div>
      <div className="mt-4">
        <ButtonList
          title="Which rule did you expect it to match?"
          emptyMessage="You haven't created any rules yet!"
          items={[
            { id: NONE_RULE_ID, name: "❌ None" },
            { id: NEW_RULE_ID, name: "✨ New rule" },
            ...rules,
          ]}
          onSelect={onSelectExpectedRuleId}
        />
      </div>
    </div>
  );
}
