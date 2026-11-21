import { describe, expect, it } from 'vitest';
import { fatoComOperadores } from './fato-do-catalogo';
import type { FatoCandidatoView, FatoDoCatalogoDto } from './fatos-candidato.api';
import { OperadorCodigo } from './schema';

const COR_RACA: FatoCandidatoView = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  descricao: 'Autodeclaração de cor ou raça.',
  dominio: 'CATEGORICO',
  origem: 'DECLARADO',
  cardinalidade: 'UNICO',
  valoresDominio: ['PRETA', 'PARDA'],
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_FORMULARIO:COR_RACA',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  classificacaoProtecao: 'SENSIVEL',
  hipoteseLegal: 'EXECUCAO_DE_POLITICA_PUBLICA',
  finalidadeTratamento: 'Aplicar a reserva de vagas.',
  protecaoAprovada: true,
  escopo: 'CANDIDATO',
};

describe('fatoComOperadores', () => {
  it('desfaz o envelope: o fato traz os operadores na ordem de oferta', () => {
    const envelope: FatoDoCatalogoDto = {
      fato: COR_RACA,
      operadoresAdmitidos: [
        { codigo: OperadorCodigo.IGUAL, rotulo: 'é igual a' },
        { codigo: OperadorCodigo.DIFERENTE, rotulo: 'é diferente de' },
      ],
    };

    const fato = fatoComOperadores(envelope);

    expect(fato.codigo).toBe('COR_RACA');
    expect(fato.operadoresAdmitidos.map((o) => o.codigo)).toEqual(['IGUAL', 'DIFERENTE']);
    expect(fato.operadoresAdmitidos[0].rotulo).toBe('é igual a');
  });
});
