import { Suspense } from 'react';

import { MapExplorer } from '@/components/map/MapExplorer';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';

import styles from './page.module.css';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.title}>Know the risks before you get there</h1>
          <p className={styles.lede}>
            Travellers report robberies, thefts, scams, harassment, natural
            hazards and unrest on a shared world map. Reports disappear after 90
            days unless others confirm them, so what you see is what is current.
          </p>
        </section>

        <Suspense fallback={null}>
          <MapExplorer />
        </Suspense>
      </main>
    </>
  );
}
