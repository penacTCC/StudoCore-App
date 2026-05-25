import { AuthUser } from "./auth";
export type UploadArquivoParams = {
  userId: string;
  arquivo: {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  };
  disciplina: string;
  gruposIds: string[];
};

export type DeletaRegistroProps = {
  arquivoId: string;
};

export type ArquivoGrupo = {
  grupo_id: string;
};

export type ArquivoProfile = {
  nome_usuario: string | null;
};

export type ArquivoDetalhe = {
  id: string;
  user_id: string;
  titulo: string;
  disciplina: string;
  storage_path: string | null;
  backblaze_file_id: string | null;
  created_at: string;
  profiles?: ArquivoProfile | null;
  arquivos_grupos?: ArquivoGrupo[];
};

export type ArquivoGrupoLink = {
  grupo_id: string;
  arquivos: ArquivoDetalhe | ArquivoDetalhe[] | null;
};

export type detalheArquivoProps = {
  detalheArquivo: ArquivoDetalhe | null,
  onClose: () => void,
  onRefresh: () => void,
  currentUser: AuthUser | null
}

export type uploadArquivoBucketProps = {
    bucket: string,
    fileName: string,
    fileExt: string,
    base64: string
}
