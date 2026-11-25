import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import { ArrowIcon, GiftCard, Header, SCREEN } from "../../ui";
import { getShare, shareHeadline } from "./share-data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) return { title: copy.notFoundTitle };
  const { title, occasion } = shareHeadline(share);
  const description = share.gifts.map((g) => g.name).join(" · ");
  return {
    title: `${title} · giftd`,
    description,
    openGraph: { title: `${title} (${occasion})`, description },
    twitter: { card: "summary_large_image" },
    robots: { index: false }, // shared lists are personal; keep them out of search results
  };
}

export default function SharedResultPage({ params }: Props) {
  return (
    <main className={SCREEN}>
      <Header logoHref="/" />
      <Suspense
        fallback={<p className="m-auto animate-pulse text-lg font-semibold text-muted">{copy.sharedLoading}</p>}
      >
        <SharedResult params={params} />
      </Suspense>
    </main>
  );
}

async function SharedResult({ params }: Props) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();
  const { title, occasion } = shareHeadline(share);

  return (
    <section className="fade-in flex flex-1 flex-col">
      <p className="mt-6 text-xs font-extrabold tracking-[0.08em] text-kicker uppercase">{occasion}</p>
      <h1 className="mt-1.5 mb-[18px] text-[30px] leading-[1.06] font-extrabold tracking-[-0.035em]">{title}</h1>
      <div className="flex flex-col gap-3">
        {share.gifts.map((g) => (
          <GiftCard key={g.kind} gift={g} />
        ))}
      </div>
      <Link
        href="/"
        className="mt-6 flex min-h-16 items-center justify-center gap-2.5 rounded-[20px] bg-solid text-lg font-extrabold text-solid-fg"
      >
        {copy.sharedCta}
        <ArrowIcon />
      </Link>
    </section>
  );
}
