import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Adapter de storage para o supabase-js que usa o Keychain (iOS) / Keystore (Android) via
 * expo-secure-store, em vez de AsyncStorage puro (SQLite/arquivo em texto plano).
 *
 * O Keychain/Keystore tem limite de ~2048 bytes por chave. A sessão do supabase-js (access_token
 * + refresh_token + dados do usuário) costuma passar disso, então quebramos o valor em pedaços
 * numerados (`chave_0`, `chave_1`, ...) e guardamos a contagem de pedaços em `chave_num_chunks`.
 *
 * Na web o SecureStore não existe (é Keychain/Keystore nativo) — cai para AsyncStorage lá.
 */

const TAMANHO_MAX_CHUNK = 2000;

function chaveChunk(chave: string, indice: number) {
  return `${chave}_${indice}`;
}

function chaveContagem(chave: string) {
  return `${chave}_num_chunks`;
}

async function getItemNativo(chave: string): Promise<string | null> {
  const contagemStr = await SecureStore.getItemAsync(chaveContagem(chave));
  if (!contagemStr) return null;

  const numChunks = Number(contagemStr);
  if (!Number.isFinite(numChunks) || numChunks <= 0) return null;

  const chunks = await Promise.all(
    Array.from({ length: numChunks }, (_, i) => SecureStore.getItemAsync(chaveChunk(chave, i)))
  );

  if (chunks.some((c) => c === null)) return null;
  return chunks.join('');
}

async function setItemNativo(chave: string, valor: string): Promise<void> {
  const numChunksAntigos = Number(await SecureStore.getItemAsync(chaveContagem(chave))) || 0;

  const novosChunks: string[] = [];
  for (let i = 0; i < valor.length; i += TAMANHO_MAX_CHUNK) {
    novosChunks.push(valor.slice(i, i + TAMANHO_MAX_CHUNK));
  }

  await Promise.all(novosChunks.map((chunk, i) => SecureStore.setItemAsync(chaveChunk(chave, i), chunk)));

  // Se o valor novo tem menos pedaços que o antigo, limpa os pedaços sobrando.
  for (let i = novosChunks.length; i < numChunksAntigos; i++) {
    await SecureStore.deleteItemAsync(chaveChunk(chave, i));
  }

  await SecureStore.setItemAsync(chaveContagem(chave), String(novosChunks.length));
}

async function removeItemNativo(chave: string): Promise<void> {
  const numChunks = Number(await SecureStore.getItemAsync(chaveContagem(chave))) || 0;
  await Promise.all(Array.from({ length: numChunks }, (_, i) => SecureStore.deleteItemAsync(chaveChunk(chave, i))));
  await SecureStore.deleteItemAsync(chaveContagem(chave));
}

export const secureStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: getItemNativo,
        setItem: setItemNativo,
        removeItem: removeItemNativo,
      };
