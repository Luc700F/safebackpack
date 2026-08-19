import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { REPORT_CATEGORIES } from '@/lib/reports/categories';

import { CategoryLegend } from './CategoryLegend';

describe('CategoryLegend', () => {
  it('lists every report category', () => {
    render(<CategoryLegend />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(REPORT_CATEGORIES.length);
  });

  it('labels each entry with its category name', () => {
    render(<CategoryLegend />);

    for (const category of REPORT_CATEGORIES) {
      expect(screen.getByText(category.label)).toBeInTheDocument();
    }
  });

  it('exposes the list to assistive technology', () => {
    render(<CategoryLegend />);

    expect(
      screen.getByRole('list', { name: 'Report categories' }),
    ).toBeInTheDocument();
  });
});
