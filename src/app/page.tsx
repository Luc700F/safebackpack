import { CategoryLegend } from '@/components/CategoryLegend/CategoryLegend';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { AGE_WINDOWS, DEFAULT_AGE_WINDOW } from '@/lib/reports/age-window';

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
            hazards and unrest on a shared world map. Reports disappear after six
            months, so what you see is what is current.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="map-heading">
          <h2 className={styles.sectionTitle} id="map-heading">
            Incident map
          </h2>
          <div className={styles.filters}>
            {AGE_WINDOWS.map((window) => (
              <span
                key={window.id}
                className={`${styles.filter} ${
                  window.id === DEFAULT_AGE_WINDOW ? styles.filterActive : ''
                }`}
              >
                {window.label}
              </span>
            ))}
          </div>
          <div className={styles.mapPlaceholder}>
            <p>The heatmap arrives in stage 3.</p>
          </div>
          <CategoryLegend />
        </section>
      </main>
    </>
  );
}
