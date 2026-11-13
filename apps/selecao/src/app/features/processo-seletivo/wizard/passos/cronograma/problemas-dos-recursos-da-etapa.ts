import {
  PAPEL_PRELIMINAR,
  type EtapaPontuada,
  type RecursoDaEtapa,
} from '../../processo-seletivo.models';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { fracaoDeDiaUtil } from '../../shared/prazo-em-dias-uteis';
import { recursoResolvido } from './cronograma-para-comando';

function nomeParaMensagem(etapa: EtapaPontuada): string {
  return etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
}

/**
 * Os problemas das janelas de recurso das etapas, na ordem em que quem preenche os resolve:
 * o prazo, a coerência da janela, a âncora e, por fim, a regra que ainda falta escolher.
 */
export function problemasDosRecursosDasEtapas(etapas: readonly EtapaPontuada[]): readonly string[] {
  return [
    ...problemasDoPrazoDaJanela(etapas),
    ...problemasDeCoerenciaDaJanela(etapas),
    ...problemasDeAncoraOrfa(etapas),
    ...problemasDeRegraPendente(etapas),
  ];
}

// Prazo que não converte vira 0 na gravação — o campo é obrigatório no comando —, e janela
// com prazo zero fecha no instante em que abre. O servidor aceita; quem perde é o candidato.
//
// Três casos com a mesma consequência: em branco, texto que a gramática numérica não aceita
// ("2,5 dias", "dois"), e zero declarado. É o mesmo conjunto que a conferência da FASE já
// cobre — a da etapa era um subconjunto estrito da irmã.
function problemasDoPrazoDaJanela(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) => {
    const invalidos = etapa.recursos.filter(
      (recurso) => recursoResolvido(recurso) && !prazoUtilizavel(recurso.prazoValor),
    ).length;
    if (invalidos === 0) return [];

    return [
      `A janela de recurso da etapa ${nomeParaMensagem(etapa)} precisa de um prazo maior que zero — informe por quanto tempo o recurso pode ser apresentado.`,
    ];
  });
}

// O value object do prazo é o mesmo na fase e na etapa, e o servidor o prova nos dois
// donos: a tela que aprovasse aqui mandaria o operador colher um 422 que a fase nunca deixaria
// acontecer.
function problemasDeCoerenciaDaJanela(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) => {
    const resolvidos = etapa.recursos.filter(recursoResolvido);
    const nome = nomeParaMensagem(etapa);
    return CONFERENCIAS_DA_JANELA.filter((c) => resolvidos.some(c.quebrada)).map((c) =>
      c.mensagem(nome),
    );
  });
}

interface ConferenciaDaJanela {
  readonly quebrada: (recurso: RecursoDaEtapa) => boolean;
  readonly mensagem: (nomeDaEtapa: string) => string;
}

const CONFERENCIAS_DA_JANELA: readonly ConferenciaDaJanela[] = [
  {
    quebrada: (r) => fracaoDeDiaUtil(r.prazoValor, r.prazoUnidade),
    mensagem: (nome) =>
      `O prazo de recurso da etapa ${nome} está em fração de dia útil. Use valor inteiro, ou declare o prazo em horas.`,
  },
  {
    quebrada: (r) => r.admiteInstanciaSuperior === null,
    mensagem: (nome) =>
      `Responda, na janela de recurso da etapa ${nome}, se ela admite recurso em instância superior.`,
  },
  {
    quebrada: suspensividadeQuebrada,
    mensagem: (nome) =>
      `A suspensividade do recurso da etapa ${nome} exige valor e unidade juntos, e maior que zero — ou nenhum dos dois, que desativa aquela instância.`,
  },
  {
    quebrada: suspensividadeEmFracaoDeDiaUtil,
    mensagem: (nome) =>
      `A suspensividade do recurso da etapa ${nome} está em fração de dia útil. Use valor inteiro, ou declare o prazo em horas.`,
  },
];

// O tempo de bloqueio da instância superior só vale quando a janela a admite: oculto, ele
// não é conferido nem enviado.
function suspensividadeQuebrada(recurso: RecursoDaEtapa): boolean {
  return (
    suspensividadeIncoerente(
      recurso.suspensividadePrimeiraInstanciaValor,
      recurso.suspensividadePrimeiraInstanciaUnidade,
    ) ||
    (recurso.admiteInstanciaSuperior === true &&
      suspensividadeIncoerente(
        recurso.suspensividadeSegundaInstanciaValor,
        recurso.suspensividadeSegundaInstanciaUnidade,
      ))
  );
}

// Só a instância superior declarada conta: oculta, ela não é conferida nem enviada.
function suspensividadeEmFracaoDeDiaUtil(recurso: RecursoDaEtapa): boolean {
  return (
    fracaoDeDiaUtil(
      recurso.suspensividadePrimeiraInstanciaValor,
      recurso.suspensividadePrimeiraInstanciaUnidade,
    ) ||
    (recurso.admiteInstanciaSuperior === true &&
      fracaoDeDiaUtil(
        recurso.suspensividadeSegundaInstanciaValor,
        recurso.suspensividadeSegundaInstanciaUnidade,
      ))
  );
}

// A janela ancorada em ato aponta para uma publicação preliminar DA PRÓPRIA etapa, e os
// produtos mudam por outro caminho: retirar o preliminar, ou trocar-lhe o ato ou o papel,
// deixava a janela apontando para o que não existe mais. A gravação seguia, e o servidor
// recusava a etapa inteira — sem dizer que o problema era a âncora, nem em qual etapa.
function problemasDeAncoraOrfa(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) =>
    temAncoraOrfa(etapa)
      ? [
          `A janela de recurso da etapa ${nomeParaMensagem(etapa)} corre da publicação de um resultado preliminar que a etapa não declara mais. Escolha outra publicação, ou remova a janela.`,
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

// A janela recursal sem regra resolvida é descartada pelo mapeador — o catálogo de regras
// ainda não respondeu, ou o código escolhido não está nele. Descartar é o certo (o servidor
// recusaria um campo que o operador não liga ao que fez); calar não é: sem este aviso, a
// janela que a pessoa acabou de declarar some na gravação e nada explica.
function problemasDeRegraPendente(etapas: readonly EtapaPontuada[]): readonly string[] {
  return etapas.flatMap((etapa) => {
    const pendentes = etapa.recursos.filter((recurso) => !recursoResolvido(recurso)).length;
    if (pendentes === 0) return [];

    const nome = nomeParaMensagem(etapa);
    return [
      pendentes === 1
        ? `A janela de recurso da etapa ${nome} está sem a regra de prazo. Escolha a regra, ou remova a janela.`
        : `${pendentes} janelas de recurso da etapa ${nome} estão sem a regra de prazo. Escolha a regra de cada uma, ou remova-as.`,
    ];
  });
}

/** Prazo que a gravação consegue usar: converte e é maior que zero. */
function prazoUtilizavel(prazo: string): boolean {
  const valor = decimalDoCampo(prazo);
  return valor !== null && valor > 0;
}

/**
 * A suspensividade é par valor-unidade: um lado sem o outro não descreve janela alguma, e a
 * ausência dos dois é a desativação prevista daquela instância. Meio par é recusado pelo
 * servidor — antes desta conferência, na etapa, era gravado calado.
 */
function suspensividadeIncoerente(valor: string, unidade: string): boolean {
  const temValor = valor.trim() !== '';
  const temUnidade = unidade !== '';

  if (!temValor && !temUnidade) return false;
  if (temValor !== temUnidade) return true;

  const numero = decimalDoCampo(valor);
  return numero === null || numero <= 0;
}
