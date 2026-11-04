import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type FormularioDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  FINALIDADE_INSCRICAO,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CatalogosDoCronograma } from '../steps/cronograma/catalogos-do-cronograma.service';
import { comCamposQueAsExigenciasPressupoem } from '../steps/formulario/campos-pressupostos-da-inscricao';
import {
  fatosCitadosPelaDerivacao,
  fatosCitadosPeloPredicado,
} from '../steps/formulario/citantes-no-processo';
import {
  conteudoDoFormulario,
  faseDaInscricao,
  fatosColetadosPor,
  fatosDasOutrasFinalidades,
  formularioDaFinalidade,
  inscricaoDoServidor,
  type FormularioParaGravar,
} from '../steps/formulario/formulario-do-processo';
import { CadastroInicial } from './cadastro-inicial.service';
import { regrasDasModalidadesOfertadas } from './regras-das-modalidades';

export type CamposPressupostos =
  | { readonly tipo: 'garantidos' }
  | { readonly tipo: 'semFaseDeInscricao' }
  | { readonly tipo: 'recusados'; readonly motivo: string };

/**
 * Os fatos que as regras de aplicabilidade das modalidades ofertadas citam, com os que citam as
 * derivações que o processo configura para os fatos citados.
 *
 * A modalidade do candidato e a opção pelas cotas da lei saem das modalidades ofertadas, no
 * servidor, e as regras delas não chegam ao assistente: o que elas citam vem com o modelo de
 * inscrição, e a publicação recusa a regra que cita o que o processo não coleta nem deriva.
 */
export function fatosCitadosPelasModalidadesOfertadas(
  servidor: ProcessoSeletivoDto,
): ReadonlySet<string> {
  const derivacoes = new Map(
    (servidor.regrasDerivacao ?? []).map((config) => [config.codigoFato, config.regras]),
  );
  const citados = new Set<string>();
  const pendentes = regrasDasModalidadesOfertadas(servidor).flatMap((modalidade) =>
    fatosCitadosPeloPredicado(modalidade.regra),
  );
  for (let fato = pendentes.pop(); fato !== undefined; fato = pendentes.pop()) {
    if (citados.has(fato)) continue;
    citados.add(fato);
    pendentes.push(...fatosCitadosPelaDerivacao(derivacoes.get(fato)));
  }
  return citados;
}

/** O que a gravação dos campos precisa: o que o servidor tem, o que desejar e em que fase. */
interface PlanoDosCampos {
  readonly gravado: FormularioDto | null;
  readonly conteudoGravado: ConteudoDoFormulario;
  readonly pressuposto: (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario;
  readonly desejado: ConteudoDoFormulario;
  readonly faseId: string;
}

/**
 * Os campos do formulário de inscrição que o processo pressupõe: os que coletam os fatos que as
 * exigências e as regras das modalidades ofertadas citam. O servidor recusa a regra que cita fato
 * que o processo não coleta; este serviço põe os campos antes, para o operador não precisar
 * lembrar que decidir quem concorre ou de quem o documento é cobrado mexe no formulário.
 */
@Injectable()
export class GravacaoDosCamposPressupostos {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly catalogos = inject(CatalogosDoCronograma);

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
    const plano = this.planejar(servidor, citados);
    if ('tipo' in plano) return plano;

    const preparo =
      plano.gravado === null
        ? await this.criarFormulario(processoId, plano)
        : {
            base: { faseId: plano.gravado.faseId, conteudo: plano.conteudoGravado },
            final: plano.desejado,
          };
    if ('tipo' in preparo) return preparo;

    const gravacao = await this.cadastro.gravarFormulario(
      processoId,
      FINALIDADE_INSCRICAO,
      preparo.base,
      { faseId: plano.faseId, conteudo: preparo.final },
    );
    if (geracao !== this.store.geracao()) return { tipo: 'garantidos' };
    if (!gravacao.ok)
      return { tipo: 'recusados', motivo: this.problemI18n.resolve(gravacao.problem).title };

    await this.acompanharNoRascunho(processoId, plano.conteudoGravado, plano.pressuposto);
    return { tipo: 'garantidos' };
  }

  /**
   * O que gravar: o conteúdo desejado e a fase de inscrição. Devolve o desfecho quando não há o que
   * gravar — o catálogo recusa, o formulário já coleta tudo ou o cronograma não tem a fase.
   */
  private planejar(
    servidor: ProcessoSeletivoDto,
    citados: ReadonlySet<string>,
  ): PlanoDosCampos | CamposPressupostos {
    const gravado = formularioDaFinalidade(servidor.formularios ?? [], FINALIDADE_INSCRICAO);
    const conteudoGravado = gravado === null ? conteudoInicial() : conteudoDoFormulario(gravado);
    const pressuposto = this.pressuposto(servidor, citados);

    const recusaDoCatalogo = this.recusaDoCatalogo(servidor, conteudoGravado, citados);
    if (recusaDoCatalogo !== null) return { tipo: 'recusados', motivo: recusaDoCatalogo };

    const desejado = pressuposto(conteudoGravado);
    if (desejado === conteudoGravado) return { tipo: 'garantidos' };

    const faseId = gravado?.faseId ?? faseDaInscricao(servidor.cronogramaFases)?.id ?? null;
    if (faseId === null) return { tipo: 'semFaseDeInscricao' };
    return { gravado, conteudoGravado, pressuposto, desejado, faseId };
  }

  /**
   * Cria o formulário de inscrição pelo cabeçalho e o relê: a API o cria com a seção dos dados
   * básicos, e os itens se conferem contra ela. Devolve o que gravar em seguida, ou o desfecho
   * quando a criação foi recusada ou o processo mudou no meio.
   */
  private async criarFormulario(
    processoId: string,
    plano: PlanoDosCampos,
  ): Promise<{ base: FormularioParaGravar; final: ConteudoDoFormulario } | CamposPressupostos> {
    const { faseId, desejado, pressuposto } = plano;
    const geracao = this.store.geracao();
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
    const base = { faseId: criado.faseId, conteudo: conteudoDoFormulario(criado) };
    return { base, final: pressuposto(base.conteudo) };
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
      comCamposQueAsExigenciasPressupoem(conteudo, {
        citados,
        catalogo: this.catalogos.fatos(),
        postosPelasExigencias: new Set(),
        fatosDeOutrasFinalidades: outras,
      });
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

    const doServidor = semEdicaoPendente
      ? await this.projetarDoServidor(processoId, geracao)
      : null;
    if (doServidor === 'obsoleto') return;
    const depois = doServidor ?? this.acrescentarNoRascunho(pressuposto);

    const acrescentados = fatosColetadosPor(depois).filter((codigo) => !antes.has(codigo));
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update(
        (atual) => new Set([...atual, ...acrescentados]),
      );
    }
  }

  /** Relê o processo e o projeta no rascunho. `null` se a leitura falhou; `'obsoleto'` se o processo mudou. */
  private async projetarDoServidor(
    processoId: string,
    geracao: number,
  ): Promise<ConteudoDoFormulario | 'obsoleto' | null> {
    const relido = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return 'obsoleto';
    if (!isApiOk(relido)) return null;

    const servidor = inscricaoDoServidor(relido.data);
    this.store.projetarSecao('formulario', servidor);
    return servidor.conteudo;
  }

  /** Com edição pendente ela fica, e só os campos acrescentados entram nela. */
  private acrescentarNoRascunho(
    pressuposto: (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario,
  ): ConteudoDoFormulario {
    const formulario = this.store.draft().formulario;
    const depois = pressuposto(formulario.conteudo);
    if (depois !== formulario.conteudo)
      this.store.patchSection('formulario', { ...formulario, conteudo: depois });
    return depois;
  }
}
