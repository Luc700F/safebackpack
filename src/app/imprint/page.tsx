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
 * Operated by a private individual in Switzerland. The address is a home
 * address and is published because an imprint requires a real postal one — a
 * post box does not satisfy it.
 *
 * TODO before wider promotion: establish whether Article 27 GDPR requires a
 * representative in the EU. A Swiss operator whose site is plainly aimed at
 * travellers in the EU can fall under it, and there is no representative named
 * here. This needs a lawyer, not a guess.
 */
export default function ImprintPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Imprint</h1>
        <p className={styles.lede}>Who is responsible for this site.</p>

        <p className={styles.draft}>
          Reviewed by a lawyer? Not yet. The details below are accurate, but the
          wording has not been checked by anybody qualified to check it.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>Operator</h2>
          <p className={styles.text}>
            Luca Fries
            <br />
            Lindenstrasse 13
            <br />
            5632 Buttwil
            <br />
            Switzerland
          </p>
          <p className={styles.text}>
            SafeBackpack is run by a private individual, not a company. It is
            free, carries no advertising, and is not a commercial service.
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
