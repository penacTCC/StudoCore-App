import { AuthSession } from "./auth";
import { LastGroupParams } from "./groups";

export type GuardProps = {
  isInitialized: boolean;
  session: AuthSession | null;
  profileComplete: boolean | null;
  isMember: boolean | null;
  lastGroupParams: LastGroupParams | null | undefined;
};