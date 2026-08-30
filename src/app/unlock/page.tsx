import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE } from "@/proxy";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; bad?: string }>;
}) {
  const params = await searchParams;

  async function unlock(formData: FormData) {
    "use server";

    const passcode = process.env.APP_PASSCODE;
    const entered = String(formData.get("passcode") ?? "");
    const target = String(formData.get("next") ?? "/") || "/";

    if (!passcode || entered !== passcode) {
      redirect(`/unlock?bad=1${target === "/" ? "" : `&next=${encodeURIComponent(target)}`}`);
    }

    const store = await cookies();
    store.set(COOKIE, passcode, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // A year: this is a phone in a kitchen, not a bank.
      maxAge: 60 * 60 * 24 * 365,
    });

    redirect(target.startsWith("/") ? target : "/");
  }

  return (
    <div className="mx-auto max-w-xs pt-[20vh] text-center">
      <h1 className="font-serif text-3xl font-semibold">Recipe Box</h1>

      <form action={unlock} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={params.next ?? "/"} />
        <input
          name="passcode"
          type="password"
          inputMode="text"
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          className="field text-center"
        />
        <button type="submit" className="btn btn-primary w-full">
          Unlock
        </button>
      </form>

      {params.bad && (
        <p className="mt-3 text-sm text-accent">That&rsquo;s not it.</p>
      )}
    </div>
  );
}
