export function buildExplanation(result: any[], question: string) {
  if (!result || result.length === 0)
    return "No records were found.";

  const q = question.toLowerCase();

  if (q.includes("month"))
    return "Here is your monthly earnings breakdown.";

  if (q.includes("today"))
    return "Here is today's income.";

  if (q.includes("stack"))
    return "Here is a stacked revenue breakdown by category.";

  return "Here are your requested results.";
}
