import { supabase } from "@/supabase";

export const buscarEstatisticasSemanais = async (userId: string) => {
  try {
    const hoje = new Date();
    const domingoPassado = new Date(hoje);
    domingoPassado.setDate(hoje.getDate() - hoje.getDay()); // Volta para o domingo desta semana
    domingoPassado.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("study_sessions")
      .select("subject, duration")
      .eq("user_id", userId)
      .gte("created_at", domingoPassado.toISOString());

    if (error) {
      console.error("Erro ao buscar estatísticas", error);
      return { totalSemanaSegundos: 0, materiaFavorita: "Nenhuma" };
    }

    let totalSemanaSegundos = 0;
    const contagemMateria: Record<string, number> = {};

    data?.forEach((sessao) => {
      totalSemanaSegundos += sessao.duration;
      if (!contagemMateria[sessao.subject]) {
        contagemMateria[sessao.subject] = 0;
      }
      contagemMateria[sessao.subject] += sessao.duration;
    });

    let materiaFavorita = "Nenhuma";
    let maiorTempo = 0;

    for (const [materia, tempo] of Object.entries(contagemMateria)) {
      if (tempo > maiorTempo) {
        maiorTempo = tempo;
        materiaFavorita = materia;
      }
    }

    return { totalSemanaSegundos, materiaFavorita };
  } catch (err) {
    console.error(err);
    return { totalSemanaSegundos: 0, materiaFavorita: "Nenhuma" };
  }
};

export const saveStudySession = async (
  userId: string,
  subject: string,
  durationSeconds: number,
  questionsSolved: number
) => {
  try {
    // 1. Inserir a sessão (Para matérias e horas semanais)
    const { error: sessionError } = await supabase.from("study_sessions").insert({
      user_id: userId,
      subject,
      duration: durationSeconds,
      questions_solved: questionsSolved,
    });

    if (sessionError) {
      console.error("Erro ao salvar study_session", sessionError);
      return false;
    }

    // 2. Buscar dados atuais do perfil para atualizar totais e streak
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("total_hours, questoes_feitas, streak, last_study_date")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Erro ao buscar profile", profileError);
      return false;
    }

    const hoje = new Date();
    const hojeStr = hoje.toISOString().split("T")[0]; // YYYY-MM-DD

    let newStreak = profile.streak || 0;
    let newLastStudyDate = profile.last_study_date;

    if (profile.last_study_date) {
      const lastDate = new Date(profile.last_study_date);
      // zera as horas para comparar só dadas
      lastDate.setHours(0, 0, 0, 0);
      const hojeDate = new Date(hojeStr);
      hojeDate.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(hojeDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Se o último estudo foi ontem, aumenta o streak
      if (diffDays === 1) {
        newStreak += 1;
        newLastStudyDate = hojeStr;
      }
      // Se for maior que 1 e não for hoje (diffDays === 0 seria hoje)
      else if (diffDays > 1 && hojeStr !== profile.last_study_date) {
        newStreak = 1;
        newLastStudyDate = hojeStr;
      }
      // Se for hoje, mantém o streak atual.
    } else {
      // Primeiro estudo
      newStreak = 1;
      newLastStudyDate = hojeStr;
    }

    // 3. Atualizar o Perfil do usuário
    const novoTotalHoras = (profile.total_hours || 0) + durationSeconds; // Armazenando em segundos, o app formata depois onde precisar.
    const novasQuestoes = (profile.questoes_feitas || 0) + questionsSolved;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        total_hours: novoTotalHoras,
        questoes_feitas: novasQuestoes,
        streak: newStreak,
        last_study_date: newLastStudyDate
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Erro ao atualizar profile", updateError);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Exceção não tratada ao salvar sessão:", err);
    return false;
  }
};
