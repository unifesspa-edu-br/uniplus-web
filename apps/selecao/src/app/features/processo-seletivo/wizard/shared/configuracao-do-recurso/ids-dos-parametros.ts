import type { IdsDoPrazo } from './prazo-do-recurso.component';
import type { CampoDosParametros } from './parametros-do-recurso';

function idsDoPrazo(base: string): IdsDoPrazo {
  return {
    valor: `${base}-valor`,
    unidade: `${base}-unidade`,
    recusasDoValor: `${base}-recusas-valor`,
    recusasDaUnidade: `${base}-recusas-unidade`,
    situacao: `${base}-situacao`,
  };
}

function idsDoPrazoDeInterposicao(prefixo: string) {
  const base = `${prefixo}-prazo-interposicao`;
  return { ...idsDoPrazo(base), ajuda: `${base}-ajuda` };
}

function idsDoPrazoDaSegundaInstancia(prefixo: string) {
  const base = `${prefixo}-prazo-segunda`;
  return { ...idsDoPrazo(base), retirar: `${base}-retirar` };
}

function idsDaInstanciaSuperior(prefixo: string) {
  return {
    sim: `${prefixo}-superior-sim`,
    nao: `${prefixo}-superior-nao`,
    ajuda: `${prefixo}-superior-ajuda`,
    erro: `${prefixo}-superior-erro`,
    recusas: `${prefixo}-superior-recusas`,
  };
}

/**
 * Os `id` das partes da configuração do recurso a partir do prefixo que a tela dá a ela: a fase usa
 * um por regra de recurso e a etapa um por recurso. São também o destino de foco da gravação
 * recusada e do "Ir ao campo".
 */
export function idsDosParametros(prefixo: string) {
  return {
    prazoDeInterposicao: idsDoPrazoDeInterposicao(prefixo),
    prazoDaSegundaInstancia: idsDoPrazoDaSegundaInstancia(prefixo),
    instanciaSuperior: idsDaInstanciaSuperior(prefixo),
    efeito: `${prefixo}-efeito`,
    guarda: `${prefixo}-guarda`,
    aviso: `${prefixo}-aviso`,
  };
}

type IdsDosParametros = ReturnType<typeof idsDosParametros>;
type Alvos = readonly string[];

function alvosDosPrazos({ prazoDeInterposicao: i, prazoDaSegundaInstancia: s }: IdsDosParametros) {
  return {
    prazoValor: [i.valor],
    prazoUnidade: [i.unidade, i.situacao],
    prazoSegundaInstanciaValor: [s.valor],
    prazoSegundaInstanciaUnidade: [s.unidade, s.situacao],
  };
}

function alvosDasEscolhas(ids: IdsDosParametros, admiteInstanciaSuperior: boolean | null) {
  const superior = ids.instanciaSuperior;
  return {
    admiteInstanciaSuperior: [
      admiteInstanciaSuperior === false ? superior.nao : superior.sim,
      superior.recusas,
    ],
    efeitoSuspensivo: [`${ids.efeito}-grupo`],
    guardaDaVaga: [`${ids.guarda}-grupo`],
  };
}

/**
 * O que recebe o foco por controle, do preferido ao de reserva. A escolha entre opções é o `id`
 * do grupo: o foco vai à opção marcada, à primeira ou, sem opção, ao parágrafo de situação. A
 * instância superior é a opção marcada, ou a primeira quando nenhuma está.
 */
export function alvosDoControleDosParametros(
  prefixo: string,
  controle: CampoDosParametros,
  admiteInstanciaSuperior: boolean | null,
): Alvos {
  const ids = idsDosParametros(prefixo);
  const alvos: Readonly<Record<CampoDosParametros, Alvos>> = {
    ...alvosDosPrazos(ids),
    ...alvosDasEscolhas(ids, admiteInstanciaSuperior),
  };
  return alvos[controle];
}
