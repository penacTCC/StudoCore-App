import { AuthSession } from "./auth";
import { ParametrosUltimoGrupo } from "./grupos";

export type GuardProps = {
  inicializado: boolean;
  session: AuthSession | null;
  perfilCompleto: boolean | null;
  membro: boolean | null;
  parametrosUltimoGrupo: ParametrosUltimoGrupo | null | undefined;
};
