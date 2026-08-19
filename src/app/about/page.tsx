import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'About',
  description: 'Why SafeBackpack exists and how it works.',
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>About</h1>
        <p className={styles.lede}>
          A map of what travellers ran into, so the next person does not have to
          find out the hard way.
        </p>

        <section className={styles.section}>
          <h2 className={styles.heading}>Why</h2>
          <p className={styles.text}>
            Official travel advice works at the level of countries and regions.
            It cannot tell you that the taxi meters at one particular station
            are rigged, or that a mountain road washed out last week. Travellers
            know those things, and mostly tell each other in passing.
            SafeBackpack is an attempt to keep that knowledge somewhere it can
            be found.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>How it works</h2>
          <ul className={styles.list}>
            <li>
              Anyone can file a report. No account — one email confirmation, so
              the map does not fill up with invented entries.
            </li>
            <li>
              A report stays for 90 days. Other travellers can say it still
              applies, which extends it, or that it no longer does, which
              retires it.
            </li>
            <li>
              After that it leaves the map and everything personal is deleted.
              Only anonymous figures remain, for statistics.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>What it is not</h2>
          <p className={styles.text}>
            Not an official advisory, not a crime database, and not a place to
            complain about a business. A heatmap shows where people reported
            things — which is not the same as where things happen, because
            travellers are not spread evenly across the world. Read it as a hint,
            not as a verdict.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>Free</h2>
          <p className={styles.text}>
            SafeBackpack is free and carries no advertising. Get in touch at{' '}
            <a href="mailto:hello@safebackpack.app">hello@safebackpack.app</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
