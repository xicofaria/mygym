export const metadata = { title: "Privacidade — Gym Tracker" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Política de privacidade</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <p>
          Que dados recolhemos: o teu email, nome e palavra-passe (guardada como
          hash), e os dados que crias — treinos e séries, medidas corporais,
          produtos e consumos de calorias (incluindo miniaturas de fotografias
          de produtos, guardadas de forma privada), metas e preferências.
        </p>
        <p>
          Fotografias usadas para análise por IA são processadas no teu
          navegador e enviadas uma única vez ao fornecedor de IA configurado;
          a aplicação não as guarda. As miniaturas que escolhes guardar no
          catálogo são privadas da tua conta.
        </p>
        <p>
          Não vendemos dados pessoais nem os usamos para publicidade. Fornecedores
          externos (alojamento, base de dados, email, fornecedor de IA) processam
          dados apenas para operar o serviço.
        </p>
        <p>
          Direitos RGPD: podes consultar e corrigir os teus dados, e eliminar a
          conta com todos os dados associados, na página Conta, a qualquer
          momento. A exportação automática ainda não está disponível; para
          pedires uma cópia dos teus dados, ou para qualquer outra questão,
          contacta o responsável da instância.
        </p>
        <p>
          Cookies: usamos apenas um cookie técnico de sessão (httpOnly) para te
          manter autenticado. Sem cookies de publicidade ou rastreio.
        </p>
      </div>
    </main>
  );
}
