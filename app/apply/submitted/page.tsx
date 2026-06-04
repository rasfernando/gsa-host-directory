import Link from "next/link";

export default function SubmittedPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Application received
      </h1>
      <p className="mt-3 text-gray-500">
        Thank you — the GSA team reviews every application personally. We&apos;ll
        contact you to arrange verification, including a video call with your
        leadership team.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm text-gray-500 underline">
        Back to home
      </Link>
    </div>
  );
}
