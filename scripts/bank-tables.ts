// Prints the question tables for "giftd — Question Bank.md" from src/lib/questions.ts.
// Run: npx tsx scripts/bank-tables.ts
import { BANK, OPENERS } from "../src/lib/questions";
import type { Question } from "../src/lib/types";

const answers = (q: Question) =>
  q.options
    .map((o) => {
      const hidden = o.hideFor ? ` *(hidden for ${o.hideFor.join(", ")})*` : "";
      return `\`${o.id}\` ${o.label}${o.fact ? ` *(${o.fact})*` : ""}${hidden}`;
    })
    .join(" · ");

function askWhen(q: Question): string {
  const w = q.when;
  const parts: string[] = [];
  if (w?.minAge && w.minAge === w.maxAge) parts.push(`age = \`${w.minAge}\``);
  else {
    if (w?.minAge) parts.push(`age ≥ \`${w.minAge}\``);
    if (w?.maxAge) parts.push(`age ≤ \`${w.maxAge}\``);
  }
  if (w?.relationship) parts.push(`relationship ${w.relationship.map((r) => `\`${r}\``).join(", ")}`);
  if (w?.notRelationship) parts.push(`not ${w.notRelationship.map((r) => `\`${r}\``).join(", ")}`);
  if (w?.occasion) parts.push(`occasion ${w.occasion.map((r) => `\`${r}\``).join(", ")}`);
  if (w?.requires) parts.push(`\`${w.requires.question} = ${w.requires.options.join(" / ")}\``);
  let s = parts.join(", ") || "—";
  if (q.excludes) s += `; excludes ${q.excludes.map((e) => `\`${e}\``).join(", ")}`;
  if (q.fun) s = s === "—" ? "for fun" : `${s}; for fun`;
  return s;
}

const sections: [string, Question["category"]][] = [
  ["Interests", "interests"],
  ["Personality", "personality"],
  ["Lifestyle", "lifestyle"],
  ["Gift style", "gift_style"],
  ["Situational (relationship, age or occasion)", "situational"],
];

const out: string[] = [];
out.push("| ID | Question | Answers |", "| --- | --- | --- |");
for (const q of OPENERS) out.push(`| \`${q.id}\` | ${q.text} | ${answers(q)} |`);
out.push("@@OPENERS_END@@");
for (const [title, cat] of sections) {
  out.push("", `## ${title}`, "", "| ID | Question | Answers | Ask when | Pri |", "| --- | --- | --- | --- | --- |");
  for (const q of BANK.filter((b) => b.category === cat)) {
    out.push(`| \`${q.id}\` | ${q.text} | ${answers(q)} | ${askWhen(q)} | ${q.priority} |`);
  }
}
console.log(out.join("\n"));
