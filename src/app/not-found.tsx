import Link from "next/link";
import { copy } from "@/lib/copy";
import { ArrowIcon, Header } from "./ui";

export default function NotFound() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-7 pb-8">
      <Header logoHref="/" />
      <section className="fade-in flex flex-1 flex-col">
        <h1 className="mt-24 text-[40px] leading-[1.04] font-extrabold tracking-[-0.04em]">{copy.notFoundTitle}</h1>
        <p className="mt-4 text-lg font-semibold text-muted">{copy.notFoundBody}</p>
        <Link
          href="/"
          className="mt-auto flex min-h-16 items-center justify-center gap-2.5 rounded-[20px] bg-solid text-lg font-extrabold text-solid-fg"
        >
          {copy.notFoundCta}
          <ArrowIcon />
        </Link>
      </section>
    </main>
  );
}
