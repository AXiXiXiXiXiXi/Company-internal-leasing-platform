import { ApplicationStatus } from '../enums';

const allowedTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.PENDING]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.APPROVED]: [ApplicationStatus.CHECKED_OUT],
  [ApplicationStatus.CHECKED_OUT]: [ApplicationStatus.RETURNED],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.RETURNED]: [],
  [ApplicationStatus.CANCELLED]: [],
};

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}
