import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What SafeBackpack stores, for how long, and why.',
};

/**
 * Privacy notice.
 *
 * Written to match what the code actually does — the retention rules here are
 * the ones in src/lib/reports/retention.ts and anonymisation.ts. If those
 * change, this page changes in the same commit.
 */
export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Privacy</h1>
        <p className={styles.lede}>
          What we store, for how long, and why. In plain words, because a
          privacy notice nobody can read protects nobody.
        </p>

        <p className={styles.draft}>
          Reviewed by a lawyer? Not yet. What follows describes exactly what the
          software does, but the wording has not been checked by anybody
          qualified to check it.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>Who is responsible</h2>
          <p className={styles.text}>
            Luca Fries, Lindenstrasse 13, 5632 Buttwil, Switzerland.
            <br />
            <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>
          </p>
          <p className={styles.text}>
            If you think your data has been handled wrongly, write to that
            address. You may also complain to a supervisory authority: in
            Switzerland the{' '}
            <a href="https://www.edoeb.admin.ch/en" rel="noreferrer">
              Federal Data Protection and Information Commissioner
            </a>
            , and in the European Union the authority where you live.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>The short version</h2>
          <ul className={styles.list}>
            <li>
              No account, no advertising, and nothing that follows you from
              site to site.
            </li>
            <li>
              Your email address is used once, to confirm your report, and is
              never shown to anyone.
            </li>
            <li>
              The position you pick is blurred by about 100 metres before it is
              published. The exact one never leaves our server.
            </li>
            <li>
              After two months — longer if others confirm it, three months at
              the very most — your report leaves the map and everything personal
              in it is deleted.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>What we store when you file a report</h2>
          <ul className={styles.list}>
            <li>Your description, category and time of day.</li>
            <li>
              The position you picked, and a separate blurred position — only
              the blurred one is ever served to anyone.
            </li>
            <li>
              Your first name and home country, both shown with the report
              unless you choose to publish without your name.
            </li>
            <li>
              Your email address, encrypted, used to send the confirmation link
              and nothing else.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>What happens when it leaves the map</h2>
          <p className={styles.text}>
            Your report leaves the map and is stripped: the email address, your
            name, the exact position and the description are deleted. What
            remains is the category, the country, a roughly 11 km grid cell, the
            month and the time of day — figures that cannot be traced back to
            you and that let us publish statistics later.
          </p>
          <p className={styles.text}>
            A report starts with two months. Each confirmation from another
            traveller keeps it for a month from the day that confirmation was
            given, and nothing stays on the map more than three months after it
            was published.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Technical data</h2>
          <p className={styles.text}>
            Your network address is stored only as an irreversible fingerprint,
            for at most seven days, to stop one machine flooding the map. It is
            never linked to your report.
          </p>
          <p className={styles.text}>
            One cookie is set, and only after you confirm an email address: a
            signed token that lets you file and confirm reports for 30 days
            without going back to your inbox. It holds no readable data about
            you and is not used to track anything.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Measurement</h2>
          <p className={styles.text}>
            We count page views and page speed through Vercel Analytics and
            Speed Insights. Neither sets a cookie, neither stores an identifier
            for you, and neither can recognise you on a later visit or on
            another site. What they produce is a number of visits per page, not
            a record of anybody.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Where the data is</h2>
          <p className={styles.text}>
            Databases and file storage are in the European Union. Email is sent
            through Resend. Map tiles come from OpenFreeMap and place search
            from Photon; both see the search terms you type, not who you are.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Your rights</h2>
          <p className={styles.text}>
            You can ask what is stored about you, ask for it to be corrected, or
            ask for it to be deleted, at any time and without giving a reason.
            Write to{' '}
            <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>.
          </p>
        </section>

        <p className={styles.updated}>Last updated 19 August 2026.</p>
      </main>
      <SiteFooter />
    </>
  );
}
