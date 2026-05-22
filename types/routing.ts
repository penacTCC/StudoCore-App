import { AuthSession } from "./auth";

export type GuardProps = {
  isInitialized: boolean;
  session: AuthSession | null;
  profileComplete: boolean | null;
  isMember: boolean | null;
  lastGroupParams: any;
};