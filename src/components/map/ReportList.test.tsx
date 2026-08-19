import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PublicReport } from '@/lib/reports/public-report';

import { ReportList } from './ReportList';

function report(overrides: Partial<PublicReport> = {}): PublicReport {
  return {
    id: 'report-1',
    categoryId: 'theft',
    customCategoryLabel: null,
    description: 'Bag snatched near the night market entrance.',
    timeOfDay: 'night',
    latitude: 13.757,
    longitude: 100.502,
    countryCode: 'TH',
    reporterFirstName: 'Luca',
    reporterHomeCountry: 'CH',
    publishedAt: new Date().toISOString(),
    confirmations: 0,
    lastConfirmedAt: null,
    severity: 0.4,
    ...overrides,
  };
}

const noop = () => undefined;

describe('ReportList', () => {
  it('renders one entry per report', () => {
    render(
      <ReportList
        reports={[report(), report({ id: 'report-2' })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('names the country the incident happened in', () => {
    render(
      <ReportList
        reports={[report({ countryCode: 'TH' })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getByText('Thailand')).toBeInTheDocument();
  });

  it('does not confuse the incident country with the reporter home country', () => {
    render(
      <ReportList
        reports={[report({ countryCode: 'TH', reporterHomeCountry: 'CH' })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getByText('Thailand')).toBeInTheDocument();
    expect(screen.getByText(/Switzerland/)).toBeInTheDocument();
  });

  it('shows the category, the description and the time of day', () => {
    render(
      <ReportList
        reports={[report()]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getByText('Pickpocketing or theft')).toBeInTheDocument();
    expect(
      screen.getByText('Bag snatched near the night market entrance.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Night/)).toBeInTheDocument();
  });

  it('names the reporter, or says they were anonymous', () => {
    const { rerender } = render(
      <ReportList
        reports={[report()]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );
    expect(screen.getByText(/Luca/)).toBeInTheDocument();

    rerender(
      <ReportList
        reports={[report({ reporterFirstName: null })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );
    expect(screen.getByText(/Anonymous/)).toBeInTheDocument();
  });

  it('mentions confirmations only once there are some', () => {
    const { rerender } = render(
      <ReportList
        reports={[report({ confirmations: 0 })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );
    expect(screen.queryByText(/Confirmed by/)).not.toBeInTheDocument();

    rerender(
      <ReportList
        reports={[report({ confirmations: 3 })]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );
    expect(screen.getByText(/Confirmed by 3 travellers/)).toBeInTheDocument();
  });

  it('opens a report when its entry is activated', async () => {
    const onSelect = vi.fn();
    render(
      <ReportList
        reports={[report({ id: 'abc' })]}
        selectedId={null}
        loading={false}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith('abc');
  });

  it('marks the open report for assistive technology', () => {
    render(
      <ReportList
        reports={[report({ id: 'abc' })]}
        selectedId="abc"
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getByRole('listitem')).toHaveAttribute('aria-current', 'true');
  });

  it('says it is loading rather than showing an empty list', () => {
    render(
      <ReportList reports={[]} selectedId={null} loading onSelect={noop} />,
    );

    expect(screen.getByText(/loading reports/i)).toBeInTheDocument();
  });

  it('explains an empty result instead of showing nothing', () => {
    render(
      <ReportList
        reports={[]}
        selectedId={null}
        loading={false}
        onSelect={noop}
      />,
    );

    expect(screen.getByText(/no reports match these filters/i)).toBeInTheDocument();
  });
});
