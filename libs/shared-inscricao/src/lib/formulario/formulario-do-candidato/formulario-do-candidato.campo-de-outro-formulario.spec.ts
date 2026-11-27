import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import {
  apresentacaoDaPagina,
  campoApresentado,
  itemDasRegras,
} from './formularios-de-exemplo.testing';
import type { AvaliacaoNaTela } from './modalidades-avaliadas';

const FORMULARIO: FormularioDoCandidato = {
  paginas: [
    {
      codigo: 'CONTATO',
      codigoNasRegras: 'Inscricao:CONTATO',
      ordem: 0,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaPagina('Contato'),
    },
    {
      codigo: 'MODALIDADES',
      codigoNasRegras: null,
      ordem: 1,
      tipo: 'BLOCO',
      bloco: 'MODALIDADES_CALCULADAS',
      apresentacao: apresentacaoDaPagina('Modalidades de concorrência'),
    },
  ],
  termos: [],
  pressupostos: { fatos: [] },
  coleta: { itens: [campoApresentado('EMAIL', 'E-mail', 'TEXTO')], grupos: [] },
  regras: { paginas: [{ codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] }] },
};

const faltando = (...fatos: string[]): AvaliacaoNaTela => ({
  modalidades: {
    derivada: true,
    situacao: 'FALTA_RESPONDER',
    itens: [],
    pendencias: fatos.map((fatoCodigo) => ({
      fatoCodigo,
      rotulo: `Responda ${fatoCodigo}`,
      secaoCodigo: 'Inscricao:CONTATO',
    })),
  },
  documentos: null,
  calculando: false,
  erro: null,
});

describe('FormularioDoCandidatoComponent: pendência da avaliação de outro formulário', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  function abrirAsModalidades(avaliacao: AvaliacaoNaTela): string[] {
    cenario.montar(FORMULARIO, { avaliacao });
    const pedidos: string[] = [];
    cenario.fixture.componentInstance.campoDeOutroFormulario.subscribe((c) => pedidos.push(c));
    cenario.clicar(cenario.botao('2'));
    return pedidos;
  }

  it('o campo que este formulário não tem é pedido a quem hospeda, que leva ao formulário dono', () => {
    const pedidos = abrirAsModalidades(faltando('CONCORRER_EP'));

    cenario.clicar(cenario.botao('Responda CONCORRER_EP'));

    expect(pedidos).toEqual(['CONCORRER_EP']);
  });

  it('o campo do próprio formulário leva à seção dele, sem pedir a quem hospeda', () => {
    const pedidos = abrirAsModalidades(faltando('EMAIL'));

    cenario.clicar(cenario.botao('Responda EMAIL'));

    expect(pedidos).toEqual([]);
    expect(cenario.tela.querySelector('h3')?.textContent).toContain('Contato');
  });
});
