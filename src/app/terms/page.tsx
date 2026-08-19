import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using SafeBackpack and for filing reports.',
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Terms of use</h1>
        <p className={styles.lede}>
          What SafeBackpack is for, and what does not belong on it.
        </p>

        <p className={styles.draft}>
          Draft, pending legal review before public launch.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>What SafeBackpack is</h2>
          <p className={styles.text}>
            A map of what travellers ran into, written by travellers. It is free
            to use and needs no account. Reports are personal accounts and are
            not verified — treat them as you would treat advice from a stranger
            in a hostel: useful, and not gospel.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Filing a report</h2>
          <ul className={styles.list}>
            <li>Report only what you experienced or witnessed yourself.</li>
            <li>
              Do not name private individuals, and do not include anything that
              would identify someone.
            </li>
            <li>
              Do not use SafeBackpack to settle a score with a business or a
              person.
            </li>
            <li>You need to be 16 or older to file a report.</li>
            <li>
              One report per incident. If somebody already reported it, confirm
              theirs instead.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Moderation</h2>
          <p className={styles.text}>
            Reports are screened automatically before they appear, and anyone
            can flag one. Reports that break these rules are removed. Repeated
            abuse means an address is blocked from filing.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>If a report concerns you</h2>
          <p className={styles.text}>
            If a report names you or your business, or is factually wrong, write
            to <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>.
            Anything credible comes off the map while it is looked at.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>No warranty</h2>
          <p className={styles.text}>
            SafeBackpack is offered as it is, free of charge, with no promise
            that it is complete, current or correct. It is not an official
            travel advisory and does not replace one. Decisions about your own
            safety remain yours.
          </p>
        </section>

        <p className={styles.updated}>Last updated 19 August 2026.</p>
      </main>
      <SiteFooter />
    </>
  );
}
