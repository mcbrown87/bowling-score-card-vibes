import { fireEvent, render, screen } from '@testing-library/react';

import { LeagueGameSwitch } from './LeagueGameSwitch';

describe('LeagueGameSwitch', () => {
  it('exposes switch semantics and toggles from the full touch target', () => {
    const onChange = jest.fn();
    render(<LeagueGameSwitch checked={false} onChange={onChange} />);

    const control = screen.getByRole('switch', { name: 'League game' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('2 teams · 8 scores')).toBeInTheDocument();

    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle while disabled', () => {
    const onChange = jest.fn();
    render(<LeagueGameSwitch checked disabled onChange={onChange} />);

    const control = screen.getByRole('switch', { name: 'League game' });
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });
});
