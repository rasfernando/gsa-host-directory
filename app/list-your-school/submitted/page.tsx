import Link from "next/link";

export default function ListingSubmittedPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Listing received
      </h1>
      <p className="mt-3 text-gray-500">
        The GSA team gives every new listing a quick review before it goes
        live — usually within a couple of days. We&apos;ll email you when
        you&apos;re in the directory.
      </p>
      <p className="mx-auto mt-6 max-w-md rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        Want more? <strong>GSA Accredited</strong> schools are actively
        promoted to visiting groups worldwide and carry the gold-standard
        verification badge.{" "}
        <Link href="/apply" className="underline">
          Apply for accreditation →
        </Link>
      </p>
    </div>
  );
}
