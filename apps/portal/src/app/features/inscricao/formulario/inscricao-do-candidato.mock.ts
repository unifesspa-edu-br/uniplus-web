import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { delay, type Observable, of } from 'rxjs';
import {
  type ApiResult,
  apiFailure,
  apiOk,
  type ProblemValidationError,
} from '@uniplus/shared-core/http';
import {
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import { maskCpf } from '@uniplus/shared-data/utils';

import {
  InscricaoDoCandidatoService,
  type OfertaDaInscricao,
} from './inscricao-do-candidato.service';

const DADOS = 'Inscricao:DADOS_PESSOAIS';
const ENDERECO = 'Inscricao:ENDERECO';

/** Um formulário de inscrição no contrato atual, para a tela andar antes da integração com a API. */
export const FORMULARIO_DE_INSCRICAO_MOCK: FormularioRenderizavelDto = {
  comprovacaoDocumental: null,
  finalidade: 'INSCRICAO',
  titulo: 'Inscrição',
  dataReferenciaFatos: '2026-12-10',
  etapas: [
    secao('DADOS_PESSOAIS', DADOS, 0, 'Dados pessoais'),
    secao('ENDERECO', ENDERECO, 1, 'Endereço'),
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 2,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      titulo: 'Revisão e aceite',
      descricao: null,
      aviso: null,
    },
  ],
  termos: [
    {
      codigo: 'VERACIDADE',
      codigoNasRegras: 'Inscricao:VERACIDADE',
      ordem: 0,
      termoId: '0199e000-0000-7000-8000-0000000000a1',
      versaoId: '0199e000-0000-7000-8000-0000000000a2',
      nome: 'Declaração de veracidade',
      texto: 'Declaro que as informações prestadas são verdadeiras.',
      baseLegal: 'Edital do processo seletivo',
      formaAceite: 'CHECKBOX',
      hashVersao: 'sha256-veracidade-v1',
    },
  ],
  fatosColetados: [
    campo('NOME', 0, 'Nome completo', 'TEXTO', DADOS, 'NOME_PESSOA'),
    campo('CPF', 1, 'CPF', 'TEXTO', DADOS, 'CPF'),
    campo('DATA_NASCIMENTO', 2, 'Data de nascimento', 'DATA', DADOS),
    campo('ENDERECO_RESIDENCIAL', 3, 'Endereço residencial', 'ENDERECO', ENDERECO),
  ],
  grupos: [],
  pressupostos: [
    {
      fatoCodigo: 'FAIXA_ETARIA',
      rotulo: 'Idade na data de referência',
      tipoRenderizacao: 'NUMERO',
      formato: null,
      valoresSelecionaveis: null,
      calculadoDe: ['DATA_NASCIMENTO'],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: DADOS,
        exibicao: null,
        grupos: [],
        itens: [item('NOME', 'NOME_PESSOA'), item('CPF', 'CPF'), item('DATA_NASCIMENTO')],
      },
      { codigo: ENDERECO, exibicao: null, grupos: [], itens: [item('ENDERECO_RESIDENCIAL')] },
    ],
    termos: [
      {
        codigo: 'Inscricao:VERACIDADE',
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
      },
    ],
    derivacoes: [],
    agregados: [],
  },
};

const OFERTAS_MOCK: readonly OfertaDaInscricao[] = [
  { id: '0199e000-0000-7000-8000-0000000000b1', nome: 'Medicina — Marabá (integral)' },
];

/**
 * A inscrição em memória, no contrato atual: o rascunho nasce no "iniciar", o salvar confere o ETag, e
 * o envio recusa por campo o que o servidor recusaria primeiro — o nome em branco e o termo sem aceite.
 * Nada vai para o navegador além da memória da página.
 */
@Injectable()
export class InscricaoDoCandidatoEmMemoria extends InscricaoDoCandidatoService {
  private readonly inscricoes = new Map<string, InscricaoDto>();

  iniciar(processoId: string): Observable<ApiResult<InscricaoDto>> {
    const existente = this.inscricoes.get(processoId);
    return responder(existente ?? this.gravar(processoId, rascunho(processoId)));
  }

  obter(processoId: string): Observable<ApiResult<InscricaoDto>> {
    const existente = this.inscricoes.get(processoId);
    return existente
      ? responder(existente)
      : recusar(404, 'uniplus.selecao.inscricao.nao_encontrada');
  }

  obterFormulario(): Observable<ApiResult<FormularioRenderizavelDto>> {
    return responder(FORMULARIO_DE_INSCRICAO_MOCK);
  }

  obterOfertas(): Observable<ApiResult<readonly OfertaDaInscricao[]>> {
    return responder(OFERTAS_MOCK);
  }

  salvar(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>> {
    const atual = this.inscricoes.get(processoId);
    if (!atual || atual.eTag !== eTag)
      return recusar(412, 'uniplus.selecao.inscricao.precondicao_falhou');
    return responder(this.gravar(processoId, comRespostas(atual, request)));
  }

  submeter(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<ComprovanteInscricaoDto>> {
    const atual = this.inscricoes.get(processoId);
    if (!atual || atual.eTag !== eTag)
      return recusar(412, 'uniplus.selecao.inscricao.precondicao_falhou');

    const errors: ProblemValidationError[] = [
      ...(textoDe(request.respostas?.['NOME']) === ''
        ? [erro('NOME', 'uniplus.selecao.inscricao.item_obrigatorio_ausente')]
        : []),
      ...((request.aceites ?? []).some((a) => a.codigo === 'VERACIDADE')
        ? []
        : [erro('VERACIDADE', 'uniplus.selecao.inscricao.termo_nao_aceito')]),
    ];
    if (errors.length > 0) return recusar(422, errors[0].code, errors);

    const enviada = this.gravar(processoId, {
      ...comRespostas(atual, request),
      situacao: SituacaoInscricao.submetida,
      numeroInscricao: atual.numeroInscricao ?? '00000001',
    });
    return responder<ComprovanteInscricaoDto>({
      cpfMascarado: maskCpf(textoDe(enviada.respostas['CPF'])),
      numeroInscricao: enviada.numeroInscricao ?? '',
      instante: new Date().toISOString(),
      hashIntegridade: 'sha256-mock',
      ofertaCursoId: enviada.ofertaCursoId,
      respostas: enviada.respostas,
      derivados: enviada.derivados,
      grupos: enviada.grupos,
      aceites: enviada.aceites,
    });
  }

  private gravar(processoId: string, inscricao: InscricaoDto): InscricaoDto {
    const revisao = Number(/:(\d+)"$/.exec(inscricao.eTag)?.[1] ?? 0) + 1;
    const gravada = { ...inscricao, eTag: `"${inscricao.id}:${revisao}"` };
    this.inscricoes.set(processoId, gravada);
    return gravada;
  }
}

function rascunho(processoId: string): InscricaoDto {
  return {
    id: '0199e000-0000-7000-8000-0000000000c1',
    processoSeletivoId: processoId,
    situacao: SituacaoInscricao.rascunho,
    numeroInscricao: null,
    versaoFormularioId: '0199e000-0000-7000-8000-0000000000c2',
    ofertaCursoId: null,
    respostas: {},
    derivados: {},
    grupos: {},
    aceites: [],
    eTag: '"0199e000-0000-7000-8000-0000000000c1:0"',
  };
}

/** Ausência no corpo preserva a resposta gravada; `null` a apaga — como o servidor faz. */
function comRespostas(atual: InscricaoDto, request: InscricaoRequest): InscricaoDto {
  const respostas: Record<string, unknown> = { ...atual.respostas };
  for (const [fato, valor] of Object.entries(request.respostas ?? {})) {
    if (valor === null) delete respostas[fato];
    else respostas[fato] = valor;
  }
  return {
    ...atual,
    ofertaCursoId: request.ofertaCursoId ?? null,
    respostas,
    grupos: request.grupos ?? {},
    aceites: request.aceites ?? [],
  };
}

function secao(
  codigo: string,
  codigoNasRegras: string,
  ordem: number,
  titulo: string,
): FormularioRenderizavelDto['etapas'][number] {
  return {
    codigo,
    codigoNasRegras,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    titulo,
    descricao: null,
    aviso: null,
  };
}

function campo(
  fatoCodigo: string,
  ordem: number,
  rotulo: string,
  tipoRenderizacao: string,
  etapaCodigo: string,
  formato: string | null = null,
): FormularioRenderizavelDto['fatosColetados'][number] {
  return {
    fatoCodigo,
    ordem,
    rotulo,
    tipoRenderizacao,
    valoresSelecionaveis: null,
    etapaCodigo,
    formato,
    ajuda: null,
    pedirConfirmacao: false,
  };
}

function item(
  fatoCodigo: string,
  formato: string | null = null,
): FormularioRenderizavelDto['regras']['etapas'][number]['itens'][number] {
  return {
    fatoCodigo,
    exibicao: null,
    obrigatoriedade: 'SEMPRE',
    predicadoObrigatoriedade: null,
    restricoes: [],
    impedimento: null,
    oferta: null,
    formato,
  };
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function erro(field: string, code: string): ProblemValidationError {
  return { field, code, message: code };
}

function responder<T>(data: T): Observable<ApiResult<T>> {
  return of(apiOk(data, 200, new HttpHeaders())).pipe(delay(200));
}

function recusar<T>(
  status: number,
  code: string,
  errors?: readonly ProblemValidationError[],
): Observable<ApiResult<T>> {
  return of(
    apiFailure(
      { type: 'about:blank', title: 'Inscrição recusada', status, code, traceId: '', errors },
      status,
      new HttpHeaders(),
    ),
  ).pipe(delay(200));
}
