import { describe, expect, it } from 'vitest';
import { fatoComOperadores } from './fato-do-catalogo';
import type { FatoCandidatoView, FatoDoCatalogoDto } from './fatos-candidato.api';
import {
  ClassificacaoDeProtecaoCodigo,
  EscopoFatoCodigo,
  HipoteseLegalTratamentoCodigo,
  OperadorCodigo,
  TipoDoDadoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
} from './schema';
import { valorDeTeste } from './vocabularios.testing';

const COR_RACA: FatoCandidatoView = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  descricao: 'Autodeclaração de cor ou raça.',
  dominio: valorDeTeste(TipoDoDadoCodigo.OPCAO),
  origem: valorDeTeste(OrigemFatoCodigo.DECLARADO),
  cardinalidade: valorDeTeste(QuantidadeDeValoresCodigo.VALOR_UNICO),
  valoresDominio: ['PRETA', 'PARDA'],
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_FORMULARIO:COR_RACA',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  classificacaoProtecao: valorDeTeste(ClassificacaoDeProtecaoCodigo.SENSIVEL),
  hipoteseLegal: valorDeTeste(HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS),
  finalidadeTratamento: 'Aplicar a reserva de vagas.',
  protecaoAprovada: true,
  escopo: valorDeTeste(EscopoFatoCodigo.CANDIDATO),
};

describe('fatoComOperadores', () => {
  it('desfaz o envelope: o fato traz os operadores na ordem de oferta', () => {
    const envelope: FatoDoCatalogoDto = {
      fato: COR_RACA,
      operadoresAdmitidos: [
        valorDeTeste(OperadorCodigo.IGUAL),
        valorDeTeste(OperadorCodigo.DIFERENTE),
      ],
    };

    const fato = fatoComOperadores(envelope);

    expect(fato.codigo).toBe('COR_RACA');
    expect(fato.operadoresAdmitidos.map((o) => o.codigo)).toEqual([
      OperadorCodigo.IGUAL,
      OperadorCodigo.DIFERENTE,
    ]);
    expect(fato.operadoresAdmitidos[0].rotulo).toBe(envelope.operadoresAdmitidos[0].rotulo);
  });
});
