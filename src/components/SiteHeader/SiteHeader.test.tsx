import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

describe('SiteHeader', () => {
  it('links the brand back to the home page', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /safebackpack/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('offers a way into the report form', () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole('link', { name: 'Report an incident' }),
    ).toHaveAttribute('href', '/report');
  });

  it('names its navigation for assistive technology', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('hides the decorative logo mark from assistive technology', () => {
    render(<SiteHeader />);

    expect(screen.getByText('sb')).toHaveAttribute('aria-hidden', 'true');
  });
});
