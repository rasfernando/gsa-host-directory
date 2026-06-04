import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Verified host schools, worldwide
      </h1>
      <p className="mt-4 text-lg text-gray-500">
        The Global School Alliance accredits schools to host visiting groups
        for immersions, exchanges and cultural visits. Apply to become a
        verified host school.
      </p>
      <div className="mt-8 flex justify-center gap-4">
        <Link
          href="/apply"
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Apply to host
        </Link>
        <span
          className="cursor-not-allowed rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-400"
          title="Directory launches once the first host schools are verified"
        >
          Browse directory — coming soon
        </span>
      </div>
    </div>
  );
}
