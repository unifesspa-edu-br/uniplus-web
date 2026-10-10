import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type ConfiguracaoDerivacaoInput,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  FINALIDADE_INSCRICAO,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CatalogosDoCronogramaService } from '../steps/cronograma/catalogos-do-cronograma.service';
import {
  comCamposQueAsExigenciasPressupoem,
  fatosCitadosPelaDerivacao,
} from '../steps/formulario/formulario-de-inscricao';
import {
  conteudoDoFormulario,
  faseDaInscricao,
  fatosColetadosPor,
  fatosDasOutrasFinalidades,
  formularioDaFinalidade,
  inscricaoDoServidor,
  type FormularioParaGravar,
} from '../steps/formulario/formulario-do-processo';
import { CadastroInicialService } from './cadastro-inicial.service';
import { FATO_MODALIDADE } from './exigencias-documentais';

/**
 * O que fazer com a matriz que o processo já grava.
 *
 * - `manter`: a matriz gravada é do processo, e a proposta só entra onde não há nenhuma.
 * - `avisarSeDesatualizada`: a que não acompanha as modalidades ofertadas é acusada, sem troca.
 * - `substituirSeDesatualizada`: o operador confirmou a troca da que não acompanha as ofertadas.
 */
export type SeHaMatrizGravada = 'manter' | 'avisarSeDesatualizada' | 'substituirSeDesatualizada';

export type PropostaDaMatriz =
  | { readonly tipo: 'nadaAGravar' }
  | {
      readonly tipo: 'gravar';
      readonly matriz: readonly ConfiguracaoDerivacaoInput[];
      readonly dependencias: readonly string[];
    }
  | { readonly tipo: 'desatualizada' }
  | { readonly tipo: 'recusada'; readonly motivo: string };

export type CamposPressupostos =
  | { readonly tipo: 'garantidos' }
  | { readonly tipo: 'semFaseDeInscricao' }
  | { readonly tipo: 'recusados'; readonly motivo: string };

/** A configuração de derivação da modalidade, quando o processo a declara. */
export function matrizDaModalidade<T extends { readonly codigoFato: string }>(
  derivacoes: readonly T[] | null | undefined,
): T | undefined {
  return (derivacoes ?? []).find((config) => config.codigoFato === FATO_MODALIDADE);
}

/** Os códigos que as regras contribuem. As regras chegam ao rascunho como valor opaco. */
export function codigosContribuidos(regras: unknown): ReadonlySet<string> {
  if (!Array.isArray(regras)) return new Set();
  return new Set(
    regras.flatMap((regra: unknown) => {
      const contribui =
        typeof regra === 'object' && regra !== null && 'contribui' in regra
          ? (regra as { contribui: unknown }).contribui
          : null;
      return typeof contribui === 'string' ? [contribui] : [];
    }),
  );
}

/**
 * A matriz gravada não acompanha as modalidades ofertadas: contribui modalidade que o quadro não
 * oferta mais, ou deixa sem regra uma que a proposta normativa deriva. Nos dois casos o candidato
 * não seria posto na modalidade certa.
 */
function desatualizada(
  gravada: unknown,
  proposta: unknown,
  ofertadas: ReadonlySet<string>,
): boolean {
  const contribuidas = codigosContribuidos(gravada);
  return (
    [...contribuidas].some((codigo) => !ofertadas.has(codigo)) ||
    [...codigosContribuidos(proposta)].some((codigo) => !contribuidas.has(codigo))
  );
}

interface RegraNaOrdem {
  readonly ordem: number | string;
  readonly contribui?: string | null;
  readonly quando?: unknown;
}

/** As mesmas regras, na mesma ordem. */
function mesmasRegras(
  gravadas: readonly RegraNaOrdem[],
  propostas: readonly RegraNaOrdem[],
): boolean {
  const forma = (regras: readonly RegraNaOrdem[]): string =>
    JSON.stringify(
      [...regras]
        .sort((a, b) => Number(a.ordem) - Number(b.ordem))
        .map((regra) => [regra.contribui ?? null, regra.quando ?? null]),
    );
  return forma(gravadas) === forma(propostas);
}

/**
 * A matriz de derivação da modalidade e os campos do formulário de inscrição que ela pressupõe.
 *
 * A modalidade não é declarada pelo candidato: ela RESULTA da avaliação dos opt-ins e das
 * elegibilidades dele contra as regras do certame. A matriz vem do próprio servidor, recortada para
 * as modalidades que o processo oferta, e não é escrita no assistente: de que opt-ins e de que
 * elegibilidades cada cota se compõe é matéria da Lei 12.711/2012, e uma segunda cópia dela aqui
 * divergiria em silêncio da que classifica os candidatos.
 *
 * As três operações se fazem nessa ordem: a proposta diz de que fatos a matriz depende, os campos
 * que os coletam entram no formulário, e só então a matriz é gravada — o servidor recusa a regra
 * que cita fato que o processo não coleta.
 */
@Injectable()
export class MatrizDaModalidadeService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly catalogos = inject(CatalogosDoCronogramaService);

  /** A matriz a gravar, e os fatos de que ela depende, conforme o que o processo já grava. */
  async proposta(
    processoId: string,
    servidor: ProcessoSeletivoDto,
    seHaMatrizGravada: SeHaMatrizGravada,
  ): Promise<PropostaDaMatriz> {
    const gravada = matrizDaModalidade(servidor.regrasDerivacao);
    if (gravada !== undefined && seHaMatrizGravada === 'manter') return { tipo: 'nadaAGravar' };

    const resposta = await firstValueFrom(this.api.obterRegrasDerivacaoNormativas(processoId));
    if (!isApiOk(resposta)) {
      return { tipo: 'recusada', motivo: this.problemI18n.resolve(resposta.problem).title };
    }

    // Proposta vazia é o processo que ainda não declarou quadro de vagas, ou que oferta só
    // modalidade de outro ramo: a norma não tem o que propor.
    const proposta = matrizDaModalidade(resposta.data);
    if (proposta === undefined) return { tipo: 'nadaAGravar' };

    const gravar = {
      tipo: 'gravar',
      matriz: resposta.data,
      dependencias: [
        ...new Set(resposta.data.flatMap((config) => fatosCitadosPelaDerivacao(config.regras))),
      ],
    } as const;
    if (gravada === undefined) return gravar;
    if (mesmasRegras(gravada.regras, proposta.regras)) return { tipo: 'nadaAGravar' };

    // A matriz que acompanha as ofertadas e difere da proposta foi ajustada pelo administrador.
    const ofertadas = new Set(
      (servidor.distribuicaoVagas ?? []).flatMap((distribuicao) =>
        distribuicao.modalidades.map((modalidade) => modalidade.codigo),
      ),
    );
    if (!desatualizada(gravada.regras, proposta.regras, ofertadas)) return { tipo: 'nadaAGravar' };

    if (seHaMatrizGravada === 'substituirSeDesatualizada') return gravar;

    // O rascunho passa a ter a matriz que o servidor grava, para a confirmação seguinte avisar
    // da troca.
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      derivacao: (servidor.regrasDerivacao ?? []).map((config) => ({
        codigoFato: config.codigoFato,
        regras: config.regras,
      })),
    });
    return { tipo: 'desatualizada' };
  }

  /** O formulário de inscrição gravado já coleta todos os fatos citados. */
  coletaTudo(servidor: ProcessoSeletivoDto, citados: ReadonlySet<string>): boolean {
    const gravado = formularioDaFinalidade(servidor.formularios ?? [], FINALIDADE_INSCRICAO);
    const conteudo = gravado === null ? conteudoInicial() : conteudoDoFormulario(gravado);
    return this.pressuposto(servidor, citados)(conteudo) === conteudo;
  }

  /**
   * Põe no formulário de inscrição os campos que coletam os fatos citados, e grava.
   *
   * Parte do estado do SERVIDOR e aplica a ele só o que falta: as edições ainda não gravadas do
   * passo Formulário são dele, e ir junto aqui as gravaria por um caminho que o operador não
   * escolheu. Nada é gravado quando não há o que acrescentar.
   *
   * Sem formulário de inscrição no servidor, ele é criado pelo cabeçalho — a seção dos outros
   * dados, a revisão e aceite e a fase que coleta inscrição — e relido: a API o cria com a seção
   * dos dados básicos, e os itens se conferem contra ela.
   */
  async garantirCampos(
    processoId: string,
    servidor: ProcessoSeletivoDto,
    citados: ReadonlySet<string>,
  ): Promise<CamposPressupostos> {
    const geracao = this.store.geracao();
    const gravado = formularioDaFinalidade(servidor.formularios ?? [], FINALIDADE_INSCRICAO);
    const conteudoGravado = gravado === null ? conteudoInicial() : conteudoDoFormulario(gravado);
    const pressuposto = this.pressuposto(servidor, citados);

    const recusaDoCatalogo = this.recusaDoCatalogo(servidor, conteudoGravado, citados);
    if (recusaDoCatalogo !== null) return { tipo: 'recusados', motivo: recusaDoCatalogo };

    const desejado = pressuposto(conteudoGravado);
    if (desejado === conteudoGravado) return { tipo: 'garantidos' };

    const faseId = gravado?.faseId ?? faseDaInscricao(servidor.cronogramaFases)?.id ?? null;
    if (faseId === null) return { tipo: 'semFaseDeInscricao' };

    let base: FormularioParaGravar | null =
      gravado === null ? null : { faseId: gravado.faseId, conteudo: conteudoGravado };
    let final = desejado;
    if (gravado === null) {
      const criacao = await this.cadastro.gravarFormulario(processoId, FINALIDADE_INSCRICAO, null, {
        faseId,
        conteudo: { ...desejado, itens: [], grupos: [], termos: [] },
      });
      if (geracao !== this.store.geracao()) return { tipo: 'garantidos' };
      if (!criacao.ok)
        return { tipo: 'recusados', motivo: this.problemI18n.resolve(criacao.problem).title };

      const relido = await firstValueFrom(this.api.obter(processoId));
      if (geracao !== this.store.geracao()) return { tipo: 'garantidos' };
      const criado = isApiOk(relido)
        ? formularioDaFinalidade(relido.data.formularios, FINALIDADE_INSCRICAO)
        : null;
      if (criado === null) {
        return {
          tipo: 'recusados',
          motivo:
            'O formulário de inscrição foi criado, mas não foi possível relê-lo para acrescentar os campos. Tente gravar de novo.',
        };
      }
      base = { faseId: criado.faseId, conteudo: conteudoDoFormulario(criado) };
      final = pressuposto(base.conteudo);
    }

    const gravacao = await this.cadastro.gravarFormulario(processoId, FINALIDADE_INSCRICAO, base, {
      faseId,
      conteudo: final,
    });
    if (geracao !== this.store.geracao()) return { tipo: 'garantidos' };
    if (!gravacao.ok)
      return { tipo: 'recusados', motivo: this.problemI18n.resolve(gravacao.problem).title };

    await this.acompanharNoRascunho(processoId, conteudoGravado, pressuposto);
    return { tipo: 'garantidos' };
  }

  /** Grava a matriz proposta. Devolve o motivo da recusa, ou `null` quando deu certo. */
  async gravar(
    processoId: string,
    matriz: readonly ConfiguracaoDerivacaoInput[],
    servidor: ProcessoSeletivoDto,
  ): Promise<string | null> {
    // O comando SUBSTITUI a coleção inteira. Enviar só a matriz de modalidade apagaria a
    // derivação de qualquer outro fato que o processo já declarasse. A proposta traz os
    // derivados que ela cita e o processo ainda não deriva; os que ele já deriva ficam.
    const propostos = new Set(matriz.map((config) => config.codigoFato));
    const preservadas = (servidor.regrasDerivacao ?? []).filter(
      (config) => !propostos.has(config.codigoFato),
    );

    const gravacao = await this.cadastro.definirRegrasDerivacao(processoId, [
      ...preservadas,
      ...matriz,
    ]);
    if (!gravacao.ok) return this.problemI18n.resolve(gravacao.problem).title;

    // O rascunho acompanha o que foi gravado — sem isto, os campos que a matriz acabou de
    // pressupor apareceriam no passo do formulário como campos que nada no certame usa, e a
    // tela pediria para conferir se ainda há motivo para pedi-los ao candidato.
    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      derivacao: [...preservadas, ...matriz].map((config) => ({
        codigoFato: config.codigoFato,
        regras: config.regras,
      })),
    });
    return null;
  }

  /**
   * O conteúdo com os campos que faltam para os fatos citados. Este caminho só ACRESCENTA — o
   * conjunto de "postos por exigência" vai vazio de propósito: quem decide TIRAR campo é o passo
   * do formulário, que sabe distinguir o que entrou por causa de um gatilho do que foi declarado
   * de propósito.
   *
   * As outras finalidades contam também como estão no rascunho: o fato que uma aba ainda não
   * gravada coleta entraria na inscrição e ficaria em dois formulários.
   */
  private pressuposto(
    servidor: ProcessoSeletivoDto,
    citados: ReadonlySet<string>,
  ): (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario {
    const outras = this.coletadosPelasOutrasFinalidades(servidor);
    return (conteudo) =>
      comCamposQueAsExigenciasPressupoem(
        conteudo,
        citados,
        this.catalogos.fatos(),
        new Set(),
        outras,
      );
  }

  private coletadosPelasOutrasFinalidades(servidor: ProcessoSeletivoDto): readonly string[] {
    return [
      ...new Set([
        ...fatosDasOutrasFinalidades(servidor.formularios ?? [], FINALIDADE_INSCRICAO),
        ...this.store
          .draft()
          .formulario.outrasFinalidades.flatMap((outra) => fatosColetadosPor(outra.conteudo)),
      ]),
    ];
  }

  /**
   * O campo de cada fato citado e ainda não coletado sai do catálogo de fatos, com nome e domínio.
   * Sem o catálogo, ou com um fato que ele não conhece, nada seria acrescentado e o servidor
   * recusaria em seguida a regra que cita o fato. A recusa pede o catálogo de novo, e gravar outra
   * vez já o encontra.
   */
  private recusaDoCatalogo(
    servidor: ProcessoSeletivoDto,
    conteudo: ConteudoDoFormulario,
    citados: ReadonlySet<string>,
  ): string | null {
    const coletados = new Set([
      ...fatosColetadosPor(conteudo),
      ...this.coletadosPelasOutrasFinalidades(servidor),
    ]);
    const naoColetados = [...citados].filter((codigo) => !coletados.has(codigo));
    if (naoColetados.length === 0) return null;

    if (this.catalogos.carregando() || this.catalogos.erro() !== null) {
      this.catalogos.carregar();
      return 'O catálogo de fatos do candidato ainda não carregou, e sem ele não é possível pôr no formulário de inscrição as perguntas de que o processo depende. Grave de novo em instantes.';
    }

    const conhecidos = new Set(this.catalogos.fatos().map((fato) => fato.codigo));
    const desconhecidos = naoColetados.filter((codigo) => !conhecidos.has(codigo));
    if (desconhecidos.length === 0) return null;
    return `O catálogo de fatos do candidato não tem ${desconhecidos.join(', ')}, de que o processo depende, e não há como perguntar isso no formulário de inscrição. Avise o suporte.`;
  }

  /**
   * Leva ao rascunho o que entrou no formulário gravado. Sem edição pendente no passo Formulário,
   * o rascunho passa a ser o que o servidor tem — com a seção dos dados básicos, se o formulário
   * acabou de nascer. Com edição pendente, ela fica, e só os campos acrescentados entram nela.
   *
   * O que entrou aqui entrou SOZINHO, e fica registrado como tal: sem isso, o formulário não
   * reconhece o campo como posto por exigência e o preserva mesmo depois de o gatilho que o pediu
   * ser apagado.
   */
  private async acompanharNoRascunho(
    processoId: string,
    conteudoGravadoAntes: ConteudoDoFormulario,
    pressuposto: (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario,
  ): Promise<void> {
    const geracao = this.store.geracao();
    const formulario = this.store.draft().formulario;
    const antes = new Set(fatosColetadosPor(formulario.conteudo));
    const semEdicaoPendente =
      JSON.stringify(formulario.conteudo) === JSON.stringify(conteudoGravadoAntes);

    let depois: ConteudoDoFormulario | null = null;
    if (semEdicaoPendente) {
      const relido = await firstValueFrom(this.api.obter(processoId));
      if (geracao !== this.store.geracao()) return;
      if (isApiOk(relido)) {
        const servidor = inscricaoDoServidor(relido.data);
        this.store.projetarSecao('formulario', servidor);
        depois = servidor.conteudo;
      }
    }
    if (depois === null) {
      depois = pressuposto(formulario.conteudo);
      if (depois !== formulario.conteudo)
        this.store.patchSection('formulario', { ...formulario, conteudo: depois });
    }

    const acrescentados = fatosColetadosPor(depois).filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update(
        (atual) => new Set([...atual, ...acrescentados]),
      );
    }
  }
}
