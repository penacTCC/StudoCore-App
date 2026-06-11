import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, BookOpen, AlertCircle, Check, Trash2, Users } from 'lucide-react-native';
import { router } from 'expo-router';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useMaterias } from '@/hooks/useMaterias';
import {
  criarMateria,
  normalizarNomeMateria,
  buscarMateriasComunidade,
} from '@/services/materias';
import type { Materia } from '@/types/materias';

export default function CriarMateriaScreen() {
  const [nomeMateria, setNomeMateria] = useState('');
  const [criando, setCriando] = useState(false);
  const [materiasComunidade, setMateriasComunidade] = useState<Materia[]>([]);
  const [carregandoComunidade, setCarregandoComunidade] = useState(false);

  const { userId } = useAuth();
  const {
    materias,
    materiasCustomizadas,
    recarregarMaterias,
    deletarMateriaComVerificacao,
  } = useMaterias(userId);

  // Carrega matérias da comunidade ao montar
  useEffect(() => {
    const carregarComunidade = async () => {
      if (!userId) return;
      setCarregandoComunidade(true);
      const resultado = await buscarMateriasComunidade(userId, materias);
      setMateriasComunidade(resultado);
      setCarregandoComunidade(false);
    };
    carregarComunidade();
  }, [userId, materias]);

  // Verifica em tempo real se a matéria já existe
  const nomeNormalizado = normalizarNomeMateria(nomeMateria);
  const jaExiste = nomeMateria.trim().length > 0 && materias.some(
    (m) => m.nomeNormalizado === nomeNormalizado
  );
  const nomeValido = nomeMateria.trim().length >= 2 && !jaExiste;

  const handleCriar = async () => {
    if (!userId || !nomeValido || criando) return;

    setCriando(true);
    const resultado = await criarMateria(userId, nomeMateria);
    setCriando(false);

    if (!resultado.sucesso) {
      Alert.alert('Erro', resultado.erro || 'Não foi possível criar a matéria.');
      return;
    }

    await recarregarMaterias();
    Alert.alert('Sucesso!', `"${resultado.materia?.nomeExibicao}" foi adicionada às suas matérias.`);
    router.back();
  };

  const handleRemover = async (materia: Materia) => {
    if (!materia.id) return;

    Alert.alert(
      'Remover matéria',
      `Deseja remover "${materia.nomeExibicao}" da sua lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await deletarMateriaComVerificacao(materia.id!, materia.nomeExibicao);
          },
        },
      ]
    );
  };

  const handleAdotarComunidade = async (materia: Materia) => {
    if (!userId || criando) return;

    setCriando(true);
    const resultado = await criarMateria(userId, materia.nomeExibicao);
    setCriando(false);

    if (!resultado.sucesso) {
      Alert.alert('Erro', resultado.erro || 'Não foi possível adicionar a matéria.');
      return;
    }

    await recarregarMaterias();
    Alert.alert('Adicionada!', `"${materia.nomeExibicao}" foi adicionada à sua lista.`);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center justify-between border-b border-slate-800">
        <Text className="text-xl font-bold text-slate-200">Nova Matéria</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
        >
          <X size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 py-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Input de Nome */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-slate-400 mb-2">
            Nome da Matéria
          </Text>
          <TextInput
            value={nomeMateria}
            onChangeText={setNomeMateria}
            placeholder="ex.: Cálculo III, Redação, Filosofia..."
            placeholderTextColor={COLORS.textMuted}
            autoFocus
            maxLength={50}
            className="bg-slate-900 border rounded-xl px-4 py-3 text-slate-200 text-base"
            style={{
              borderColor: jaExiste
                ? '#f43f5e'
                : nomeValido
                  ? '#10b981'
                  : COLORS.border,
            }}
          />

          {/* Feedback visual em tempo real */}
          {nomeMateria.trim().length > 0 && (
            <View className="flex-row items-center gap-2 mt-2">
              {jaExiste ? (
                <>
                  <AlertCircle size={14} color="#f43f5e" />
                  <Text className="text-xs text-rose-400">
                    Essa matéria já existe na sua lista
                  </Text>
                </>
              ) : nomeValido ? (
                <>
                  <Check size={14} color="#10b981" />
                  <Text className="text-xs text-emerald-400">
                    Nome disponível!
                  </Text>
                </>
              ) : (
                <Text className="text-xs text-slate-500">
                  O nome precisa ter pelo menos 2 caracteres
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Matérias Customizadas do Usuário (com remoção) */}
        {materiasCustomizadas.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-slate-400 mb-3">
              Suas matérias criadas
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {materiasCustomizadas.map((materia) => (
                <View
                  key={materia.id || materia.nomeNormalizado}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderColor: 'rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <BookOpen size={12} color={COLORS.emeraldLight} />
                  <Text className="text-xs font-medium" style={{ color: '#cbd5e1' }}>
                    {materia.nomeExibicao}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemover(materia)}
                    className="ml-1 w-5 h-5 rounded-full items-center justify-center"
                    style={{ backgroundColor: 'rgba(244, 63, 94, 0.2)' }}
                  >
                    <X size={10} color="#fb7185" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Matérias Padrão */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-slate-400 mb-3">
            Matérias padrão do app
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {materias
              .filter((m) => m.isPadrao)
              .map((materia) => (
                <View
                  key={materia.nomeNormalizado}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor:
                      materia.nomeNormalizado === nomeNormalizado
                        ? 'rgba(244, 63, 94, 0.15)'
                        : 'rgba(30, 41, 59, 0.5)',
                    borderColor:
                      materia.nomeNormalizado === nomeNormalizado
                        ? 'rgba(244, 63, 94, 0.4)'
                        : 'rgba(51, 65, 85, 0.6)',
                  }}
                >
                  <BookOpen
                    size={12}
                    color={
                      materia.nomeNormalizado === nomeNormalizado
                        ? '#fb7185'
                        : COLORS.violetLight
                    }
                  />
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color:
                        materia.nomeNormalizado === nomeNormalizado
                          ? '#fb7185'
                          : '#cbd5e1',
                    }}
                  >
                    {materia.nomeExibicao}
                  </Text>
                </View>
              ))}
          </View>
        </View>

        {/* Matérias da Comunidade */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-3">
            <Users size={14} color="#94a3b8" />
            <Text className="text-sm font-medium text-slate-400">
              Matérias da comunidade
            </Text>
          </View>

          {carregandoComunidade ? (
            <View className="py-4 items-center">
              <ActivityIndicator color={COLORS.violetLight} size="small" />
              <Text className="text-xs text-slate-500 mt-2">Buscando matérias...</Text>
            </View>
          ) : materiasComunidade.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {materiasComunidade.map((materia) => (
                <TouchableOpacity
                  key={materia.id || materia.nomeNormalizado}
                  onPress={() => handleAdotarComunidade(materia)}
                  disabled={criando}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    borderColor: 'rgba(99, 102, 241, 0.25)',
                  }}
                >
                  <Plus size={12} color="#818cf8" />
                  <Text className="text-xs font-medium" style={{ color: '#a5b4fc' }}>
                    {materia.nomeExibicao}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="text-xs text-slate-600">
              Nenhuma matéria nova encontrada na comunidade
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Botão de Criar */}
      <View
        className="px-4 pb-6 pt-3 border-t border-slate-800"
        style={{ backgroundColor: COLORS.bgPrimary }}
      >
        <TouchableOpacity
          disabled={!nomeValido || criando}
          onPress={handleCriar}
          className="py-4 rounded-2xl flex-row items-center justify-center gap-2"
          style={{
            backgroundColor: nomeValido && !criando ? '#8b5cf6' : COLORS.bgTertiary,
            shadowColor: nomeValido ? '#8b5cf6' : 'transparent',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: nomeValido ? 0.3 : 0,
            shadowRadius: 12,
            elevation: nomeValido ? 8 : 0,
          }}
        >
          {criando ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Plus size={20} color={nomeValido ? COLORS.white : COLORS.textMuted} />
              <Text
                className="font-semibold text-lg"
                style={{ color: nomeValido ? COLORS.white : COLORS.textMuted }}
              >
                Criar Matéria
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
