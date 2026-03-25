import AsyncStorage from '@react-native-async-storage/async-storage';

//Cria dois caches para armazenar os grupos do usuário e os grupos públicos
const MY_GROUPS_KEY = '@my_groups_cache';
const PUBLIC_GROUPS_KEY = '@public_groups_cache';

// Salva os grupos do usuário
export const saveMyGroupsLocally = async (groupsData: any[]) => {
  try {
    //Transforma os dados em string para salvar no AsyncStorage
    const jsonValue = JSON.stringify(groupsData);
    await AsyncStorage.setItem(MY_GROUPS_KEY, jsonValue);
  } catch (e) {
    console.error('Erro ao salvar os meus grupos offline:', e);
  }
};

// Lê os grupos do usuário
export const loadMyGroupsLocally = async () => {
  try {
    //Transforma a string em objeto
    const jsonValue = await AsyncStorage.getItem(MY_GROUPS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Erro ao ler os meus grupos offline:', e);
    return null;
  }
};

// Salva os grupos públicos
export const savePublicGroupsLocally = async (groupsData: any[]) => {
  try {
    //Transforma os dados em string para salvar no AsyncStorage
    const jsonValue = JSON.stringify(groupsData);
    await AsyncStorage.setItem(PUBLIC_GROUPS_KEY, jsonValue);
  } catch (e) {
    console.error('Erro ao salvar os grupos públicos offline:', e);
  }
};

// Lê os grupos públicos
export const loadPublicGroupsLocally = async () => {
  try {
    //Transforma a string em objeto
    const jsonValue = await AsyncStorage.getItem(PUBLIC_GROUPS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Erro ao ler os grupos públicos offline:', e);
    return null;
  }
};

// Salva o último grupo acessado
export const saveLastGroupLocally = async (groupId: string) => {
  try {
    await AsyncStorage.setItem('@last_group_id', groupId);
  } catch (e) {
    console.error('Erro ao salvar o ultimo grupo offline:', e);
  }
};

// Lê o último grupo acessado
export const loadLastGroupLocally = async () => {
  try {
    return await AsyncStorage.getItem('@last_group_id');
  } catch (e) {
    console.error('Erro ao ler o ultimo grupo offline:', e);
    return null;
  }
};
