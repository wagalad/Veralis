import { Link } from 'react-router-dom'
import LegalPage, { H, P, UL, LI, Mail } from './LegalPage'

export default function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="July 13, 2026">
      <P>
        These Terms of Use ("Terms") are a legal agreement between you and <strong>Raghav K</strong>{' '}
        ("Veralis", "we", "us") governing your use of the Veralis web app (the "Service"). By
        creating an account or using the Service, you agree to these Terms. If you do not agree, do
        not use the Service.
      </P>

      <H>1. Eligibility</H>
      <P>You must be <strong>13 years of age or older</strong> to create an account or use the Service. By using Veralis, you represent that you are at least 13. The Service is not intended for, and may not be used by, children under 13.</P>

      <H>2. Your account</H>
      <P>You are responsible for keeping your login credentials secure and for all activity under your account. Provide accurate information when you register.</P>

      <H>3. Acceptable use</H>
      <P>You agree not to:</P>
      <UL>
        <LI>upload unlawful, harassing, hateful, or infringing content;</LI>
        <LI>upload photos of people without appropriate permission (Veralis is for scouting robots, not photographing individuals);</LI>
        <LI>attempt to access another team's data, or probe, scan, or breach security or access controls;</LI>
        <LI>misuse invite codes, impersonate others, or share accounts;</LI>
        <LI>disrupt the Service or use it to violate any law or the rules of the VEX Robotics Competition or the Robotics Education &amp; Competition Foundation.</LI>
      </UL>

      <H>4. Your content</H>
      <P>You keep ownership of the scouting entries, notes, and photos you submit ("Your Content"). You grant us a limited license to store, display, and process Your Content solely to operate the Service for you and your team. This includes processing by our third-party AI providers to generate features you request, such as AI scouting summaries and rules-assistant answers (see our <Link to="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>). You are responsible for Your Content and confirm you have the right to submit it.</P>

      <H>5. Data and privacy</H>
      <P>Your use of the Service is also governed by our <Link to="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>, which explains how we handle your information.</P>

      <H>6. Third-party data, services, and AI features</H>
      <P>The Service displays VEX competition data retrieved from the VEX / REC Foundation API. That data is provided by third parties, and we do not guarantee its accuracy, completeness, or availability. Veralis is not affiliated with, endorsed by, or sponsored by VEX Robotics, Innovation First, or the REC Foundation.</P>
      <P>Veralis includes AI-assisted features (the rules assistant and scouting summaries) powered by third-party AI providers. AI-generated content may be inaccurate or incomplete and is provided for convenience only. It is <strong>not official</strong> and is not a substitute for the official VEX Game Manual, the VEX Q&amp;A system, or a Head Referee's ruling. Do not rely on it for competition decisions — always verify anything important against the authoritative source.</P>

      <H>7. Service availability</H>
      <P>The Service is provided on an "as is" and "as available" basis. We may change, suspend, or discontinue any part of it at any time, and we do not guarantee it will be uninterrupted or error-free.</P>

      <H>8. Disclaimers and limitation of liability</H>
      <P>To the fullest extent permitted by law, we disclaim all warranties, express or implied, including fitness for a particular purpose. To the fullest extent permitted by law, we will not be liable for any indirect, incidental, or consequential damages, or for any loss of data, arising from your use of the Service. The Service is a free tool provided to help teams; use it at your own discretion.</P>

      <H>9. Termination</H>
      <P>You may stop using the Service and delete your account at any time. We may suspend or terminate access if you violate these Terms or to protect the Service or its users.</P>

      <H>10. Changes to these Terms</H>
      <P>We may update these Terms. If we make material changes, we will take reasonable steps to notify you. Continued use after changes take effect means you accept the updated Terms.</P>

      <H>11. Contact</H>
      <P>Raghav K — <Mail />.</P>
    </LegalPage>
  )
}
