import { OPENERS } from "@/lib/questions";
import type { PublicQuestion } from "@/lib/types";
import Quiz from "./quiz";

export default function Home() {
  // Strip server-only `fact`s before anything reaches the browser.
  const openers: PublicQuestion[] = OPENERS.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options.map(({ id, label }) => ({ id, label })),
  }));
  return <Quiz openers={openers} />;
}
