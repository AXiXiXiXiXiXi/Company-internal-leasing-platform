import { ApplicationStatus } from '../enums';
import { canTransitionApplication } from './state-transitions';

describe('canTransitionApplication', () => {
  it('allows only the supported forward flow', () => {
    expect(canTransitionApplication(
      ApplicationStatus.PENDING,
      ApplicationStatus.APPROVED,
    )).toBe(true);
    expect(canTransitionApplication(
      ApplicationStatus.APPROVED,
      ApplicationStatus.CHECKED_OUT,
    )).toBe(true);
    expect(canTransitionApplication(
      ApplicationStatus.CHECKED_OUT,
      ApplicationStatus.RETURNED,
    )).toBe(true);
  });

  it('allows pending terminal outcomes', () => {
    expect(canTransitionApplication(
      ApplicationStatus.PENDING,
      ApplicationStatus.REJECTED,
    )).toBe(true);
    expect(canTransitionApplication(
      ApplicationStatus.PENDING,
      ApplicationStatus.CANCELLED,
    )).toBe(true);
  });

  it('rejects backward and repeated transitions', () => {
    expect(canTransitionApplication(
      ApplicationStatus.RETURNED,
      ApplicationStatus.CHECKED_OUT,
    )).toBe(false);
    expect(canTransitionApplication(
      ApplicationStatus.APPROVED,
      ApplicationStatus.APPROVED,
    )).toBe(false);
  });
});
