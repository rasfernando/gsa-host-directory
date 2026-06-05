// PLACEHOLDER — GSA must review and replace with their full privacy policy
// before public launch. Kept deliberately factual and minimal until then.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy notice</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">
        <p>
          This platform is operated by the Global School Alliance (GSA). When
          you create an account, list a school, apply for accreditation, or
          send an enquiry, we collect the information you provide — your name,
          email address, school details, and the content of your submission.
        </p>
        <p>
          We use this information to operate the host school directory: to
          review listings and accreditation applications, to respond to and
          facilitate enquiries, and to contact you about your school&apos;s
          participation in the GSA network. We do not sell your personal
          information.
        </p>
        <p>
          Data is stored securely within the European Union (London region).
          Contact details for schools are never shown publicly — directory
          profiles display only the school information you choose to list.
        </p>
        <p>
          To access, correct, or delete your data, or for any privacy
          question, contact{" "}
          <a className="underline" href="mailto:hello@globalschoolalliance.com">
            hello@globalschoolalliance.com
          </a>
          .
        </p>
        <p className="text-xs text-gray-500">
          A full privacy policy is being finalised and will replace this
          notice.
        </p>
      </div>
    </div>
  );
}
