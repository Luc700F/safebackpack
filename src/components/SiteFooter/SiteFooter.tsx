import Link from 'next/link';

import styles from './SiteFooter.module.css';

const GROUPS = [
  {
    title: 'SafeBackpack',
    links: [
      { href: '/statistics', label: 'Statistics' },
      { href: '/about', label: 'About' },
      { href: '/report', label: 'Report an incident' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/imprint', label: 'Imprint' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.name}>SafeBackpack</span>
          <p className={styles.blurb}>
            Travellers reporting what they ran into, so the next person does
            not. Free to use, no account, and nothing kept longer than it is
            useful.
          </p>
          <p className={styles.legal}>
            Not an official travel advisory. For those, check your own foreign
            ministry.
          </p>
        </div>

        <nav className={styles.nav} aria-label="Footer">
          {GROUPS.map((group) => (
            <div className={styles.group} key={group.title}>
              <span className={styles.groupTitle}>{group.title}</span>
              {group.links.map((link) => (
                <Link className={styles.link} href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
