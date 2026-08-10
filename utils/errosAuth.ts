/**
 * Traduz as mensagens de erro do Supabase Auth, que chegam sempre em inglês.
 *
 * As telas de auth passavam `error.message` cru para o toast, então quem errava a senha
 * lia "Invalid login credentials" num app inteiro em português. A comparação é por trecho
 * porque o Supabase muda o texto exato entre versões, mas mantém o núcleo da frase.
 */
const TRADUCOES: ReadonlyArray<[RegExp, string]> = [
    [/invalid login credentials/i, "E-mail ou senha incorretos."],
    [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
    [/user already registered|already been registered/i, "Já existe uma conta com este e-mail."],
    [/password should be at least (\d+)/i, "A senha precisa ter pelo menos $1 caracteres."],
    [/password.*(pwned|compromised|leaked|data breach)/i,
        "Esta senha apareceu em vazamentos conhecidos. Escolha outra."],
    [/new password should be different/i, "A nova senha precisa ser diferente da atual."],
    [/token has expired or is invalid|invalid.*token/i, "O código expirou ou está incorreto."],
    [/for security purposes.*?(\d+) seconds/i, "Aguarde $1 segundos antes de tentar de novo."],
    [/email rate limit exceeded|over_email_send_rate_limit/i,
        "Muitos e-mails enviados. Aguarde alguns minutos."],
    [/request rate limit reached|too many requests/i, "Muitas tentativas. Aguarde um pouco e tente de novo."],
    [/unable to validate email address|invalid format/i, "E-mail inválido."],
    [/signups not allowed|signup is disabled/i, "Os cadastros estão temporariamente desativados."],
    [/user not found/i, "Não encontramos uma conta com esses dados."],
    [/network request failed|aborted|timeout/i, "Sem conexão com o servidor. Verifique sua internet."],
];

export function traduzirErroAuth(mensagem?: string | null): string {
    if (!mensagem) return "Algo deu errado. Tente de novo em instantes.";

    for (const [padrao, traducao] of TRADUCOES) {
        const encontrado = mensagem.match(padrao);
        if (!encontrado) continue;

        // Descarta o resto da mensagem original de propósito: traduzir só o trecho casado
        // deixaria sobras em inglês (e pontuação dobrada) grudadas no texto em português.
        return traducao.replace(/\$(\d)/g, (_, indice) => encontrado[Number(indice)] ?? "");
    }

    return mensagem;
}
