import LegalPage, { H, P, UL, LI, Mail } from './LegalPage'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="July 13, 2026">
      <P>
        Veralis ("Veralis", "we", "us", or "our") operates the Veralis web app (the "Service"),
        a scouting tool for VEX Robotics teams. This Privacy Policy explains what information we
        collect, how we use it, and the choices you have.
      </P>
      <P><strong>Operator:</strong> Raghav K<br /><strong>Contact:</strong> <Mail /></P>
      <P>
        Veralis is intended for users <strong>13 years of age and older</strong>. See the
        "Children" section below.
      </P>

      <H>1. Information we collect</H>
      <P>We deliberately collect as little as possible.</P>
      <P><strong>Information you provide directly:</strong></P>
      <UL>
        <LI><strong>Account details:</strong> your email address and a password (stored only as a securely hashed value by our authentication provider — we never see or store your plaintext password).</LI>
        <LI><strong>Display name:</strong> if you sign in with Google or Apple, we import your name from that provider to show it to your teammates. You can change or remove it.</LI>
        <LI><strong>Scouting entries:</strong> notes and ratings you record about robots and teams (drivetrain, intake, scoring, autonomous performance, a reliability rating, and an optional short note). This is competition observation data, not personal information about people.</LI>
        <LI><strong>Optional robot photos:</strong> if you attach a photo to a scouting entry, it is stored in a private storage bucket visible only to your team.</LI>
        <LI><strong>Team information:</strong> the VEX team number and name you create or join, and invite codes used to join a team.</LI>
        <LI><strong>AI assistant questions:</strong> when you use the in-app rules assistant, the questions you type are sent to our AI provider (see Section 3) to generate an answer. Please don't include personal or sensitive information in them.</LI>
      </UL>
      <P><strong>Information collected automatically:</strong> basic technical data needed to operate the app (e.g., authentication session tokens). We do <strong>not</strong> use third-party advertising or behavioral tracking, and we do not sell data.</P>

      <H>2. How we use information</H>
      <P>We use the information above only to:</P>
      <UL>
        <LI>create and secure your account and sign you in;</LI>
        <LI>let you and your teammates share scouting observations within your team;</LI>
        <LI>provide AI-assisted features, such as generated scouting summaries and the rules assistant;</LI>
        <LI>operate, maintain, and improve the Service; and</LI>
        <LI>respond to support requests and enforce our Terms of Use.</LI>
      </UL>

      <H>3. How information is shared</H>
      <UL>
        <LI><strong>With your team.</strong> Scouting entries, robot photos, your display name, and your team membership are visible to other members of the same Veralis team. They are <strong>not</strong> visible to any other team — team data is isolated at the database level (row-level security), a core design guarantee of Veralis.</LI>
        <LI><strong>Service providers (subprocessors):</strong> Supabase (authentication, database, file storage); Vercel (application hosting); <strong>OpenAI</strong> (powers the AI rules assistant — the questions you type are sent to OpenAI to generate a response); <strong>Google</strong> (sign-in, if you choose it, and Google's Gemini AI, which generates the AI scouting summaries from your team's scouting entries); <strong>Apple</strong> (only if you choose to sign in with Apple); <strong>hCaptcha</strong> (Intuition Machines, Inc. — bot and abuse protection on sign-up and sign-in); and the VEX / Robotics Education &amp; Competition Foundation API — we send only public VEX team numbers and event IDs to retrieve public match, ranking, and skills data. No personal or account information is sent to the VEX API. Our AI providers (OpenAI and Google) process the inputs we send them only to generate the requested output; we do not use this data for advertising and do not sell it.</LI>
        <LI><strong>Legal reasons.</strong> We may disclose information if required by law or to protect the safety, rights, or property of users or the public.</LI>
        <LI><strong>We do not sell personal information</strong> and do not share it for advertising.</LI>
      </UL>

      <H>4. Data retention</H>
      <P>We keep your information for as long as your account is active. When an account or team is deleted, the associated personal data is deleted or anonymized within a reasonable period, except where we must retain it to comply with law.</P>

      <H>5. Your choices and rights</H>
      <P>You can view and update your display name in the app, request a copy of your personal data, and request deletion of your account and associated personal data. To make any of these requests, contact <Mail />. Depending on where you live (e.g., California, the EU/UK), you may have additional rights over your personal data, and we honor applicable requests.</P>

      <H>6. Security</H>
      <P>Access to team data is enforced at the database level so that one team cannot see another team's data. Passwords are hashed by our authentication provider. Robot photos are stored in a private bucket. No system is perfectly secure, but we take reasonable measures to protect your information.</P>

      <H>7. Children</H>
      <P>Veralis is intended for users <strong>13 years of age and older</strong>, and is <strong>not directed to children under 13</strong>. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information without appropriate permission, please contact us at <Mail /> and we will review the request and delete the information.</P>

      <H>8. Changes to this policy</H>
      <P>We may update this Privacy Policy. If we make material changes, we will take reasonable steps to notify affected users.</P>

      <H>9. Contact</H>
      <P>Questions about this policy or your data: Raghav K — <Mail />.</P>
    </LegalPage>
  )
}
