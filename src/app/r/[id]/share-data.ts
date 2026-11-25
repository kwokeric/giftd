import { cache } from "react";
import { copy } from "@/lib/copy";
import { OCCASION_OPTIONS } from "@/lib/occasion";
import { loadShare } from "@/lib/shares";
import type { ShareRecord } from "@/lib/shares";

/** One lookup per request, shared by the page, its metadata and its preview image. */
export const getShare = cache(loadShare);

export function shareHeadline(share: ShareRecord) {
  const recipient = copy.recipient[share.relationship ?? "other"];
  const occasion = OCCASION_OPTIONS.find((o) => o.id === share.occasion)?.label ?? "";
  return { title: copy.sharedTitle(recipient), occasion };
}
