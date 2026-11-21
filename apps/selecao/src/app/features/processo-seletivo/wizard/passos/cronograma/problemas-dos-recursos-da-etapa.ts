import { PAPEL_PRELIMINAR, type EtapaPontuada } from '../../processo-seletivo.models';
import { recursoResolvido } from './cronograma-para-comando';

function nomeParaMensagem(etapa: EtapaPontuada): string {
  return etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
}

/**
 * Os problemas dos recursos das etapas, na ordem em que quem preenche os resolve: a instância
 * superior ainda sem resposta, a publicação de que o prazo corre e, por fim, a regra que ainda
 * falta escolher. Prazo, efeito suspensivo e guarda da vaga são conferidos pela API.
 */
export function problemasDosRecursosDasEtapas(etapas: readonly EtapaPontuada[]): readonly string[] {
  return [
    ...problemasDaInstanciaSuperiorEmAberto(etapas),
    ...problemasDeAncoraOrfa(etapas),
    ...problemasDeRegraPendente(etapas),
  ];
}

// A pergunta em aberto não tem padrão na API: gravar com `Não` sem a pessoa ter dito seria decidir
// por ela.
function problemasDaInstanciaSuperiorEmAberto(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) => {
    const emAberto = etapa.recursos.some(
      (recurso) => recursoResolvido(recurso) && recurso.admiteInstanciaSuperior === null,
    );
    return emAberto
      ? [
          `Responda, no recurso da etapa ${nomeParaMensagem(etapa)}, se ele admite instância superior.`,
        ]
      : [];
  });
}

// O recurso ancorado em ato aponta para uma publicação preliminar DA PRÓPRIA etapa, e os
// produtos mudam por outro caminho: retirar o preliminar, ou trocar-lhe o ato ou o papel,
// deixava o recurso apontando para o que não existe mais. A gravação seguia, e o servidor
// recusava a etapa inteira — sem dizer que o problema era a âncora, nem em qual etapa.
function problemasDeAncoraOrfa(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) =>
    temAncoraOrfa(etapa)
      ? [
          `O recurso da etapa ${nomeParaMensagem(etapa)} corre da publicação de um resultado preliminar que a etapa não declara mais. Escolha outra publicação, ou remova o recurso.`,
        ]
      : [],
  );
}

function temAncoraOrfa(etapa: EtapaPontuada): boolean {
  const preliminares = new Set(
    etapa.produtos.filter((p) => p.papel === PAPEL_PRELIMINAR).map((p) => p.atoCodigo),
  );
  return etapa.recursos.some(
    (recurso) =>
      recurso.ancora === 'atoPublicado' &&
      recursoResolvido(recurso) &&
      !preliminares.has(recurso.atoAncoraCodigo),
  );
}

// O recurso sem regra resolvida é descartado pelo mapeador — o catálogo de regras ainda não
// respondeu, ou o código escolhido não está nele. Descartar é o certo (o servidor recusaria um
// campo que o operador não liga ao que fez); calar não é: sem este aviso, o recurso que a pessoa
// acabou de declarar some na gravação e nada explica.
function problemasDeRegraPendente(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) => {
    const pendentes = etapa.recursos.filter((recurso) => !recursoResolvido(recurso)).length;
    if (pendentes === 0) return [];

    const nome = nomeParaMensagem(etapa);
    return [
      pendentes === 1
        ? `O recurso da etapa ${nome} está sem a regra de prazo. Escolha a regra, ou remova o recurso.`
        : `${pendentes} recursos da etapa ${nome} estão sem a regra de prazo. Escolha a regra de cada um, ou remova-os.`,
    ];
  });
}
