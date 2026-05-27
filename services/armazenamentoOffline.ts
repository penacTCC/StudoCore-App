import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Grupo, GrupoPublico } from '@/types/grupos';

const MY_GROUPS_KEY = '@my_groups_cache';
const PUBLIC_GROUPS_KEY = '@public_groups_cache';
const LAST_GROUP_KEY = '@last_group_id';

export const salvarMeusGruposLocalmente = async (dadosGrupos: Grupo[]) => {
  try {
    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(MY_GROUPS_KEY, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os meus grupos offline:', erro);
  }
};

export const carregarMeusGruposLocalmente = async (): Promise<Grupo[] | null> => {
  try {
    const valorJson = await AsyncStorage.getItem(MY_GROUPS_KEY);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os meus grupos offline:', erro);
    return null;
  }
};

export const salvarGruposPublicosLocalmente = async (dadosGrupos: GrupoPublico[]) => {
  try {
    const valorJson = JSON.stringify(dadosGrupos);
    await AsyncStorage.setItem(PUBLIC_GROUPS_KEY, valorJson);
  } catch (erro) {
    console.error('Erro ao salvar os grupos publicos offline:', erro);
  }
};

export const carregarGruposPublicosLocalmente = async (): Promise<GrupoPublico[] | null> => {
  try {
    const valorJson = await AsyncStorage.getItem(PUBLIC_GROUPS_KEY);
    return valorJson != null ? JSON.parse(valorJson) : null;
  } catch (erro) {
    console.error('Erro ao ler os grupos publicos offline:', erro);
    return null;
  }
};

export const salvarUltimoGrupoLocalmente = async (grupoId: string) => {
  try {
    await AsyncStorage.setItem(LAST_GROUP_KEY, grupoId);
  } catch (erro) {
    console.error('Erro ao salvar o ultimo grupo offline:', erro);
  }
};

export const carregarUltimoGrupoLocalmente = async () => {
  try {
    return await AsyncStorage.getItem(LAST_GROUP_KEY);
  } catch (erro) {
    console.error('Erro ao ler o ultimo grupo offline:', erro);
    return null;
  }
};
