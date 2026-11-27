import { comEscopoPeloCodigo } from '@uniplus/shared-data/configuracao';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type FormularioDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { conteudoInicial, type ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CatalogoDeFatos } from '../passos/cronograma/catalogos/catalogo-de-fatos.service';
import {
  fatosCitadosPelaDerivacao,
  fatosCitadosPeloPredicado,
} from '../passos/formulario/citantes-no-processo';
import {
  fatosAcrescentados,
  formularioDaInscricaoDoServidor,
  formularioDoServidor,
} from '../passos/formulario/formulario-do-processo';
import {
  comFormulario,
  conteudoDaInscricao,
  fatosColetadosPelasOutras,
  formularioDaInscricao,
} from '../passos/formulario/formularios-do-rascunho';
import { CadastroInicial } from './cadastro-inicial.service';
import { PlanoDosCamposPressupostos } from './plano-dos-campos-pressupostos';
import { regrasDasModalidadesOfertadas } from './regras-das-modalidades';

/** Os códigos das fases do servidor em que o candidato se inscreve. */
function fasesDaInscricaoDe(servidor: ProcessoSeletivoDto): ReadonlySet<string> {
  return new Set(
    servidor.cronogramaFases
      .filter((fase) => fase.faseCanonica.coletaInscricao)
      .map((fase) => fase.codigo),
  );
}

export type CamposPressupostos =
  | { readonly tipo: 'garantidos' }
  | { readonly tipo: 'semFaseDeInscricao' }
  | { readonly tipo: 'semFormularioDeInscricao' }
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
  const citados = regrasDasModalidadesOfertadas(servidor).flatMap((modalidade) =>
    fatosCitadosPeloPredicado(modalidade.regra),
  );
  return comOsCitadosPelasDerivacoes(citados, derivacoes);
}

function comOsCitadosPelasDerivacoes(
  citacoes: readonly string[],
  derivacoes: ReadonlyMap<string, unknown>,
): ReadonlySet<string> {
  const citados = new Set<string>();
  const pendentes = [...citacoes];
  for (let fato = pendentes.pop(); fato !== undefined; fato = pendentes.pop()) {
    if (citados.has(fato)) continue;
    citados.add(fato);
    pendentes.push(...fatosCitadosPelaDerivacao(derivacoes.get(fato)));
  }
  return citados;
}

const FORMULARIO_NAO_RELIDO =
  'O formulário de inscrição foi criado, mas não foi possível relê-lo para acrescentar os campos. Tente gravar de novo.';
const CATALOGO_INDISPONIVEL =
  'O catálogo de fatos do candidato ainda não carregou, e sem ele não é possível pôr no formulário de inscrição as perguntas de que o processo depende. Grave de novo em instantes.';

function mensagemDosDesconhecidos(desconhecidos: readonly string[]): string {
  return `O catálogo de fatos do candidato não tem ${desconhecidos.join(', ')}, de que o processo depende, e não há como perguntar isso no formulário de inscrição. Avise o suporte.`;
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
  private readonly catalogoDeFatos = inject(CatalogoDeFatos);

  /** O formulário de inscrição gravado já coleta todos os fatos citados. */
  coletaTudo(servidor: ProcessoSeletivoDto, citados: ReadonlySet<string>): boolean {
    return this.planejar(servidor, citados).coletaTudo();
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
    const desfecho = this.recusaDoCatalogo(plano) ?? plano.desfechoSemGravar();
    if (desfecho !== null) return desfecho;
    const gravacao = await this.gravarNoServidor(processoId, plano);
    if (geracao !== this.store.geracao() || gravacao.tipo !== 'garantidos') return gravacao;
    await this.acompanharNoRascunho(processoId, servidor, plano);
    return gravacao;
  }

  private planejar(
    servidor: ProcessoSeletivoDto,
    citados: ReadonlySet<string>,
  ): PlanoDosCamposPressupostos {
    const rascunho = this.store.draft().formulario;
    const inscricao = formularioDaInscricao(rascunho, fasesDaInscricaoDe(servidor));
    const codigo = inscricao?.codigo ?? '';
    return new PlanoDosCamposPressupostos(servidor, {
      citados,
      catalogo: comEscopoPeloCodigo(this.catalogoDeFatos.fatos()),
      fatosDosOutrosFormularios: fatosColetadosPelasOutras(rascunho.formularios, codigo),
      codigoParaCriar: inscricao?.gravado === false ? codigo : null,
    });
  }

  private async gravarNoServidor(
    processo: string,
    plano: PlanoDosCamposPressupostos,
  ): Promise<CamposPressupostos> {
    const geracao = this.store.geracao();
    const formulario = plano.gravado ?? (await this.criarFormulario(processo, plano));
    if ('tipo' in formulario) return formulario;
    const { servidor, desejado } = plano.gravacaoSobre(formulario);
    const { codigo } = formulario;
    const retorno = await this.cadastro.gravarFormulario(processo, codigo, servidor, desejado);
    return this.desfechoDaGravacao(geracao, retorno) ?? { tipo: 'garantidos' };
  }

  private async criarFormulario(
    processoId: string,
    plano: PlanoDosCamposPressupostos,
  ): Promise<FormularioDto | CamposPressupostos> {
    const geracao = this.store.geracao();
    const resultado = await this.cadastro.gravarFormulario(
      processoId,
      plano.codigoParaCriar ?? '',
      null,
      plano.cabecalhoParaCriar(),
    );
    return (
      this.desfechoDaGravacao(geracao, resultado) ?? this.formularioCriado(processoId, geracao)
    );
  }

  private async formularioCriado(
    processoId: string,
    geracao: number,
  ): Promise<FormularioDto | CamposPressupostos> {
    const relido = await this.releituraDoProcesso(processoId, geracao);
    if (relido === 'obsoleto') return { tipo: 'garantidos' };
    return (
      (relido === null ? null : formularioDaInscricaoDoServidor(relido)) ?? {
        tipo: 'recusados',
        motivo: FORMULARIO_NAO_RELIDO,
      }
    );
  }

  private desfechoDaGravacao(
    geracao: number,
    resultado: Awaited<ReturnType<CadastroInicial['gravarFormulario']>>,
  ): CamposPressupostos | null {
    if (geracao !== this.store.geracao()) return { tipo: 'garantidos' };
    return resultado.ok
      ? null
      : { tipo: 'recusados', motivo: this.problemI18n.resolve(resultado.problem).title };
  }

  private recusaDoCatalogo(plano: PlanoDosCamposPressupostos): CamposPressupostos | null {
    if (plano.fatosNaoColetados().length === 0) return null;
    if (this.catalogoDeFatos.carregando() || this.catalogoDeFatos.erro() !== null) {
      this.catalogoDeFatos.carregar();
      return { tipo: 'recusados', motivo: CATALOGO_INDISPONIVEL };
    }
    const desconhecidos = plano.desconhecidosDoCatalogo();
    return desconhecidos.length === 0
      ? null
      : { tipo: 'recusados', motivo: mensagemDosDesconhecidos(desconhecidos) };
  }

  private async acompanharNoRascunho(
    processoId: string,
    servidor: ProcessoSeletivoDto,
    plano: PlanoDosCamposPressupostos,
  ): Promise<void> {
    const antes = this.conteudoDaInscricaoNoRascunho(servidor);
    const depois = await this.levarAoRascunho(processoId, servidor, plano);
    if (depois === 'obsoleto') return;
    const acrescentados = fatosAcrescentados(antes, depois);
    if (acrescentados.length > 0) {
      this.store.camposPostosPelasExigencias.update((atual) =>
        atual.comOsQueEntraram(acrescentados),
      );
    }
  }

  private async levarAoRascunho(
    processoId: string,
    servidor: ProcessoSeletivoDto,
    plano: PlanoDosCamposPressupostos,
  ): Promise<ConteudoDoFormulario | 'obsoleto'> {
    const geracao = this.store.geracao();
    const conteudo = this.conteudoDaInscricaoNoRascunho(servidor);
    const semEdicao = JSON.stringify(conteudo) === JSON.stringify(plano.conteudoGravado);
    const doServidor = semEdicao ? await this.projetarDoServidor(processoId, geracao) : null;
    if (doServidor === 'obsoleto') return 'obsoleto';
    return (
      doServidor ??
      this.acrescentarNoRascunho(servidor, (atual) => plano.comOsCamposQueFaltam(atual))
    );
  }

  private conteudoDaInscricaoNoRascunho(servidor: ProcessoSeletivoDto): ConteudoDoFormulario {
    return conteudoDaInscricao(this.store.draft().formulario, fasesDaInscricaoDe(servidor));
  }

  /** Relê o processo e o projeta no rascunho. `null` se a leitura falhou; `'obsoleto'` se o processo mudou. */
  private async projetarDoServidor(
    processoId: string,
    geracao: number,
  ): Promise<ConteudoDoFormulario | 'obsoleto' | null> {
    const relido = await this.releituraDoProcesso(processoId, geracao);
    if (relido === 'obsoleto' || relido === null) return relido;

    const inscricao = formularioDaInscricaoDoServidor(relido);
    if (inscricao === null) return null;
    const doServidor = formularioDoServidor(relido, inscricao);
    this.store.projetarSecao('formulario', {
      formularios: comFormulario(this.store.draft().formulario, doServidor).formularios,
    });
    return doServidor.conteudo;
  }

  private async releituraDoProcesso(
    processoId: string,
    geracao: number,
  ): Promise<ProcessoSeletivoDto | 'obsoleto' | null> {
    const relido = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return 'obsoleto';
    return isApiOk(relido) ? relido.data : null;
  }

  /** Com edição pendente ela fica, e só os campos acrescentados entram nela. */
  private acrescentarNoRascunho(
    servidor: ProcessoSeletivoDto,
    pressuposto: (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario,
  ): ConteudoDoFormulario {
    const rascunho = this.store.draft().formulario;
    const inscricao = formularioDaInscricao(rascunho, fasesDaInscricaoDe(servidor));
    if (inscricao === null) return pressuposto(conteudoInicial());
    const depois = pressuposto(inscricao.conteudo);
    if (depois === inscricao.conteudo) return depois;
    this.store.patchSection(
      'formulario',
      comFormulario(rascunho, { ...inscricao, conteudo: depois }),
    );
    return depois;
  }
}
