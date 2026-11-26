import { seletorDoCampo } from './seletor-do-campo.testing';
import type { TestRequest } from '@angular/common/http/testing';
import { LISTA, type Pagina, criado } from './fatos-candidato.testing';
import { emManutencao, trabalha } from './fatos-candidato.fixtures';

export const campo = (nome: string): string => seletorDoCampo(nome);
export const CRIACAO = '#cfg-fato-criacao';

export const PREENCHIMENTO_DO_DERIVADO: Record<string, string> = {
  nome: 'Perfil socioeconômico',
  descricao: 'Perfil que define a reserva de vagas.',
  codigo: 'PERFIL',
  dominio: 'SIM_OU_NAO',
  pontoResolucao: 'INSCRICAO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

/** Conduz o drawer de criação como a pessoa faz, sobre a página que o teste montou. */
export class ConducaoDaCriacao {
  constructor(private readonly pagina: () => Pagina) {}

  readonly preencher = (valores: Record<string, string>): void => {
    for (const [nome, valor] of Object.entries(valores)) this.pagina().digitar(campo(nome), valor);
  };

  readonly escolherTipo = async (tipo: string): Promise<void> => {
    const p = this.pagina();
    await p.acionar(p.elemento(`input[type="radio"][value="${tipo}"]`));
    p.atenderApoios();
    await p.propagar();
  };

  /** O fato criado segue no drawer, em edição: a lista e o próprio fato são relidos. */
  readonly entregar = async (pedido: TestRequest): Promise<void> => {
    const p = this.pagina();
    pedido.flush(...criado());
    await p.propagar();
    p.pedidoDaLista().flush([]);
    p.atenderPendencias();
    p.http
      .expectOne(`${LISTA}/novo-id`)
      .flush(emManutencao({ ...trabalha, id: 'novo-id', codigo: 'PERFIL' }));
    await p.propagar();
  };

  readonly criar = async (): Promise<void> => {
    const p = this.pagina();
    p.submeter(CRIACAO);
    await p.propagar();
  };

  readonly abrirDerivado = async (): Promise<void> => {
    const p = this.pagina();
    await p.abrirCriacao();
    await this.escolherTipo('DERIVADO');
    this.preencher(PREENCHIMENTO_DO_DERIVADO);
    await p.propagar();
  };
}
