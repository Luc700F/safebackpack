import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Imprint',
  description: 'Who operates SafeBackpack, and how to reach them.',
};

/**
 * Legal notice.
 *
 * The operating entity is not decided yet, so the fields that depend on it are
 * marked rather than invented. Publishing an imprint with made-up details
 * would be worse than publishing none.
 */
export default function ImprintPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Imprint</h1>
        <p className={styles.lede}>Who is responsible for this site.</p>

        <p className={styles.draft}>
          Draft. The operating entity has not been settled, so the details below
          are incomplete. They will be filled in and reviewed by a lawyer before
          SafeBackpack is announced publicly.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>Operator</h2>
          <p className={styles.text}>
            {/* TODO: legal name, address and — if a company — register number
                and VAT id, once the operating entity is decided. */}
            To be completed.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Contact</h2>
          <p className={styles.text}>
            <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Responsibility for content</h2>
          <p className={styles.text}>
            Reports on SafeBackpack are written by travellers, not by the
            operator. They are the personal accounts of the people who filed
            them and are not verified independently.
          </p>
          <p className={styles.text}>
            If a report is wrong, names someone, or should not be published,
            write to <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>{' '}
            or use the report button on the entry itself. Anything credible is
            taken off the map while it is looked at.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Not a travel advisory</h2>
          <p className={styles.text}>
            SafeBackpack is not an official source and does not replace one. For
            travel advice, consult your own foreign ministry — for Swiss
            travellers, the{' '}
            <a
              href="https://www.eda.admin.ch/eda/en/fdfa/representations-and-travel-advice.html"
              rel="noreferrer"
            >
              FDFA travel advice
            </a>
            .
          </p>
        </section>

        <p className={styles.updated}>Last updated 19 August 2026.</p>
      </main>
      <SiteFooter />
    </>
  );
}
