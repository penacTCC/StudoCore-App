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

export type detalheArquivoProps = {
    detalheArquivo: any | null,
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
