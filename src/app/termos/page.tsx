export const metadata = { title: "Termos — Gym Tracker" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Termos de utilização</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <p>
          O Gym Tracker é uma aplicação pessoal de registo de treinos, medidas
          corporais e calorias. Ao criar uma conta aceitas estes termos.
        </p>
        <p>
          <strong>1. Conta.</strong> É responsável por manter a tua
          palavra-passe segura. Uma conta por pessoa; os dados são privados da
          tua conta.
        </p>
        <p>
          <strong>2. Saúde.</strong> A aplicação é um registo de atividade, não
          um conselheiro médico ou nutricional. Os valores e sugestões gerados
          por IA (incluindo estimativas nutricionais) são aproximados, devem ser
          confirmados nas embalagens/rótulos e não constituem aconselhamento
          médico, nutricional ou de treino. Consulta um profissional
          qualificado antes de mudar de dieta ou treino.
        </p>
        <p>
          <strong>3. Dados.</strong> Podes eliminar a tua conta e todos os
          dados associados a qualquer momento na página Conta. Não vendemos
          dados pessoais.
        </p>
        <p>
          <strong>4. Disponibilidade.</strong> O serviço é fornecido tal como
          está, sem garantias de disponibilidade. Funcionalidades de IA
          dependem de fornecedores externos e têm limites de utilização.
        </p>
        <p>
          Dúvidas sobre estes termos: contacta o responsável da instância que
          estás a usar.
        </p>
      </div>
    </main>
  );
}
