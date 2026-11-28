import type {
  DocumentoDaConfiguracaoBaseLegal,
  DocumentoDaConfiguracaoCronogramaFase,
  DocumentoDaConfiguracaoExigencia,
} from '@uniplus/shared-data/selecao';
import { baseLegalParaEnvio } from '@uniplus/shared-utils';

import type {
  BaseLegalConfig,
  FormatosAceitos,
  ModeloDaExigencia,
  PrazoDeEmissao,
  ReferenciaDoDocumento,
  ValidadeDoDocumento,
} from '../../modelos/exigencias.models';
import { comCampo } from '../edicoes/secao-do-documento';

export type Fases = readonly DocumentoDaConfiguracaoCronogramaFase[];
type Exigencia = DocumentoDaConfiguracaoExigencia;
type Prazo = NonNullable<Exigencia['prazoDeEmissao']>;
type Validade = NonNullable<Exigencia['validade']>;
type Referencia = NonNullable<Prazo['referencia']>;
type Formatos = NonNullable<Exigencia['formatosPermitidos']>;

export function faseCodigoDaChave(fases: Fases, chave: string | undefined): string | undefined {
  return fases.find((fase) => fase.chave === chave)?.tipoFaseCodigo;
}

export function faseChaveDoCodigo(fases: Fases, codigo: string): string | undefined {
  return fases.find((fase) => fase.tipoFaseCodigo === codigo)?.chave;
}

function referenciaNoEditor(
  referencia: Referencia | undefined,
  fases: Fases,
): ReferenciaDoDocumento | null {
  if (referencia === undefined) return null;
  const faseCodigo = faseCodigoDaChave(fases, referencia.faseChave);
  return {
    tipo: referencia.tipo ?? null,
    data: referencia.data ?? null,
    faseCodigo: faseCodigo ?? null,
    faseIdLido: faseCodigo === undefined ? (referencia.faseChave ?? null) : null,
  };
}

function referenciaNoDocumento(referencia: ReferenciaDoDocumento, fases: Fases): Referencia {
  const faseChave =
    referencia.faseCodigo === null
      ? referencia.faseIdLido
      : faseChaveDoCodigo(fases, referencia.faseCodigo);
  return {
    ...(referencia.tipo !== null && { tipo: referencia.tipo as Referencia['tipo'] }),
    ...(referencia.data !== null && { data: referencia.data }),
    ...(faseChave != null && { faseChave }),
  };
}

export function prazoNoEditor(prazo: Prazo | undefined, fases: Fases): PrazoDeEmissao | null {
  if (prazo === undefined) return null;
  return {
    escolha: prazo.escolha ?? '',
    valor: prazo.valor ?? null,
    unidade: prazo.unidade ?? null,
    referencia: referenciaNoEditor(prazo.referencia, fases),
    efeitoForaDoPrazo: prazo.efeitoForaDoPrazo ?? null,
  };
}

export function prazoNoDocumento(prazo: PrazoDeEmissao, fases: Fases): Prazo {
  return {
    ...(prazo.escolha !== '' && { escolha: prazo.escolha as Prazo['escolha'] }),
    ...(prazo.valor !== null && { valor: prazo.valor }),
    ...(prazo.unidade !== null && { unidade: prazo.unidade as Prazo['unidade'] }),
    ...(prazo.referencia !== null && {
      referencia: referenciaNoDocumento(prazo.referencia, fases),
    }),
    ...(prazo.efeitoForaDoPrazo !== null && {
      efeitoForaDoPrazo: prazo.efeitoForaDoPrazo as Prazo['efeitoForaDoPrazo'],
    }),
  };
}

export function validadeNoEditor(
  validade: Validade | undefined,
  fases: Fases,
): ValidadeDoDocumento | null {
  if (validade === undefined) return null;
  return {
    escolha: validade.escolha ?? '',
    referencia: referenciaNoEditor(validade.referencia, fases),
    efeitoDoVencimento: validade.efeitoDoVencimento ?? null,
  };
}

export function validadeNoDocumento(validade: ValidadeDoDocumento, fases: Fases): Validade {
  return {
    ...(validade.escolha !== '' && { escolha: validade.escolha as Validade['escolha'] }),
    ...(validade.referencia !== null && {
      referencia: referenciaNoDocumento(validade.referencia, fases),
    }),
    ...(validade.efeitoDoVencimento !== null && {
      efeitoDoVencimento: validade.efeitoDoVencimento as Validade['efeitoDoVencimento'],
    }),
  };
}

export function formatosNoEditor(formatos: Formatos | undefined): FormatosAceitos {
  if (formatos === undefined || formatos.qualquer === true) return { tipo: 'qualquer' };
  const itens = (formatos.lista ?? []).map((item) => ({
    formato: item.formato ?? '',
    tamanhoMaximoBytes: item.tamanhoMaximoBytesMax ?? null,
  }));
  return { tipo: 'lista', itens };
}

export function formatosNoDocumento(formatos: FormatosAceitos): Formatos {
  if (formatos.tipo === 'qualquer') return { qualquer: true };
  return {
    lista: formatos.itens.map(({ formato, tamanhoMaximoBytes }) => ({
      formato: formato as NonNullable<Formatos['lista']>[number]['formato'],
      ...(tamanhoMaximoBytes !== null && { tamanhoMaximoBytesMax: tamanhoMaximoBytes }),
    })),
  };
}

export function modeloNoEditor(exigencia: Exigencia): ModeloDaExigencia | null {
  if (exigencia.modeloId === undefined) return null;
  return {
    modeloId: exigencia.modeloId,
    nomeArquivo: exigencia.modelo?.nomeArquivo ?? '',
    formato: exigencia.modelo?.formato ?? '',
    hashSha256: exigencia.modelo?.hashSha256 ?? '',
  };
}

/** O modelo citado só pelo identificador: o resumo do arquivo é só de leitura e a API o devolve. */
export function comModelo(exigencia: Exigencia, modelo: ModeloDaExigencia | null): Exigencia {
  return comCampo(comCampo(exigencia, 'modelo', undefined), 'modeloId', modelo?.modeloId);
}

export function baseLegalNoEditor(base: DocumentoDaConfiguracaoBaseLegal): BaseLegalConfig {
  return {
    referencia: base.referencia ?? '',
    abrangencia: base.abrangencia ?? '',
    situacao: base.situacao ?? '',
    observacao: base.observacao ?? null,
  };
}

type Abrangencia = NonNullable<DocumentoDaConfiguracaoBaseLegal['abrangencia']>;
type Situacao = NonNullable<DocumentoDaConfiguracaoBaseLegal['situacao']>;

export function baseLegalNoDocumento(base: BaseLegalConfig): DocumentoDaConfiguracaoBaseLegal {
  const { referencia, abrangencia, situacao, observacao } = baseLegalParaEnvio(base);
  return {
    referencia,
    abrangencia: abrangencia as Abrangencia,
    situacao: situacao as Situacao,
    ...(observacao !== null && { observacao }),
  };
}
