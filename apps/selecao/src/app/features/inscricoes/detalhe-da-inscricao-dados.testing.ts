import {
  ExibicaoDoValorDoItemCodigo,
  FormaDoValorDoItemCodigo,
  SituacaoDoArquivoDoCandidatoCodigo,
  type ArquivoAdministrativoDto,
  type InscricaoAdministrativaDto,
  type ItemDeRespostaDto,
  type OfertaEscolhidaDto,
} from '@uniplus/shared-data/selecao';

import { INSCRICAO_ENVIADA } from './situacoes-da-inscricao.testing';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
export const INSCRICAO_ID = '01960000-0000-7000-0000-0000000006b1';
export const OUTRA_INSCRICAO_ID = '01960000-0000-7000-0000-0000000006b2';
export const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}`;
export const ROTA_OUTRA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes/${OUTRA_INSCRICAO_ID}`;
export const OFERTA_MEDICINA = '01960000-0000-7000-0000-00000000aaa1';
export const LAUDO_ID = '01960000-0000-7000-0000-0000000007c1';
export const OUTRO_ARQUIVO_ID = '01960000-0000-7000-0000-0000000007c3';
export const SEGUNDO_ARQUIVO_OMITIDO_ID = '01960000-0000-7000-0000-0000000007c4';
export const COMPROVANTE_ID = '01960000-0000-7000-0000-0000000007c2';
export const EXIGENCIA_ID = '01960000-0000-7000-0000-0000000008d1';
export const OUTRA_EXIGENCIA_ID = '01960000-0000-7000-0000-0000000008d2';

export const PROCESSO = { id: PROCESSO_ID, nome: 'PSR 2027' };
export const MEDICINA = 'Medicina (Bacharelado) — Faculdade de Medicina — INTEGRAL';
export const DIREITO = 'Direito (Bacharelado) — Faculdade de Direito — Noturno';

export const oferta = (ordem: number, nome: string | null): OfertaEscolhidaDto => ({
  id: `${OFERTA_MEDICINA.slice(0, -1)}${ordem}`,
  nome,
  ordem,
});

export const exibicao = (codigo: ExibicaoDoValorDoItemCodigo): ItemDeRespostaDto['componente'] => ({
  codigo,
  rotulo: codigo,
});

const RESPOSTA_PADRAO = {
  descricao: '',
  componente: exibicao(ExibicaoDoValorDoItemCodigo.PADRAO),
  podeRevelar: false,
};

export function item(
  fatoCodigo: string,
  rotulo: string,
  tipo: FormaDoValorDoItemCodigo,
  valor: unknown,
): ItemDeRespostaDto {
  return {
    fatoCodigo,
    rotulo,
    ...RESPOSTA_PADRAO,
    tipo: { codigo: tipo, rotulo: tipo },
    valor,
  };
}

const DADOS_DO_ARQUIVO_VERIFICADO = {
  exigenciaId: EXIGENCIA_ID,
  tipoDeMidia: 'application/pdf',
  classificacaoProtecao: 'SENSIVEL',
  situacao: { codigo: SituacaoDoArquivoDoCandidatoCodigo.VERIFICADO, rotulo: 'Verificado' },
  tamanhoBytes: 2048,
  confirmadoEm: '2026-12-10T15:00:00Z',
};

export function arquivo(
  arquivoId: string,
  nomeDoDocumento: string,
  extra: Partial<ArquivoAdministrativoDto> = {},
): ArquivoAdministrativoDto {
  return {
    ...DADOS_DO_ARQUIVO_VERIFICADO,
    arquivoId,
    nomeDoDocumento,
    ...extra,
  } as ArquivoAdministrativoDto;
}

export const FERNANDA: InscricaoAdministrativaDto = {
  id: INSCRICAO_ID,
  processo: PROCESSO,
  situacao: INSCRICAO_ENVIADA,
  ofertas: [oferta(1, MEDICINA), oferta(2, DIREITO)],
  numeroInscricao: '2027-000101',
  enviadaEm: '2026-12-10T15:00:00Z',
  secoes: [
    {
      codigo: 'identificacao',
      titulo: 'Dados pessoais',
      itens: [
        item(
          'NOME',
          'Nome completo',
          FormaDoValorDoItemCodigo.TEXTO,
          'Fernanda Laura Nicole Drumond',
        ),
        {
          ...item('CPF', 'CPF', FormaDoValorDoItemCodigo.TEXTO, '***.598.363-**'),
          componente: exibicao(ExibicaoDoValorDoItemCodigo.CPF),
          descricao: 'Cadastro de pessoa física.',
          podeRevelar: true,
        },
        {
          ...item('MUNICIPIO', 'Município de residência', FormaDoValorDoItemCodigo.OPCAO, {
            codigo: '1505502',
            rotulo: 'Marabá',
          }),
          descricao: 'Onde você mora hoje.',
        },
        {
          ...item('RENDA', 'Renda familiar', FormaDoValorDoItemCodigo.NUMERO, '1234.56'),
          componente: exibicao(ExibicaoDoValorDoItemCodigo.MOEDA),
        },
        item('NASCIMENTO', 'Data de nascimento', FormaDoValorDoItemCodigo.DATA, '2000-03-09'),
        item('PCD', 'Pessoa com deficiência', FormaDoValorDoItemCodigo.SIM_OU_NAO, true),
        item('ATENDIMENTO', 'Atendimentos', FormaDoValorDoItemCodigo.OPCOES, [
          { codigo: 'a', rotulo: 'Prova ampliada' },
          { codigo: 'b', rotulo: 'Tempo adicional' },
        ]),
        item('ENDERECO', 'Endereço', FormaDoValorDoItemCodigo.ENDERECO, {
          logradouro: 'Folha 31',
          numero: '12',
          bairro: 'Nova Marabá',
          municipio: 'Marabá',
          uf: 'PA',
          cep: '68500-000',
        }),
      ],
      grupos: [
        {
          codigo: 'FORMACAO',
          rotulo: 'Formação anterior',
          ocorrencias: [
            {
              id: 'o1',
              itens: [
                item('CURSO_ANT', 'Curso anterior', FormaDoValorDoItemCodigo.TEXTO, 'Enfermagem'),
              ],
            },
            {
              id: 'o2',
              itens: [
                item('CURSO_ANT', 'Curso anterior', FormaDoValorDoItemCodigo.TEXTO, 'Biologia'),
              ],
            },
          ],
        },
      ],
    },
  ],
  derivados: [
    item('MODALIDADES', 'Modalidades', FormaDoValorDoItemCodigo.OPCOES, [
      { codigo: 'AC', rotulo: 'Ampla concorrência' },
    ]),
  ],
  arquivos: [
    arquivo(LAUDO_ID, 'Laudo médico'),
    arquivo(COMPROVANTE_ID, 'Comprovante de residência', { exigenciaId: OUTRA_EXIGENCIA_ID }),
  ],
  podeEmitirComprovante: false,
  numeroDoUltimoComprovante: null,
};
