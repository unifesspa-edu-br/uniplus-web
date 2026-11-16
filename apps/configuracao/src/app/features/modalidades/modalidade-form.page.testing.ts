import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { ModalidadeFormPage } from './modalidade-form.page';
import { AC, BASE, URL, URL_CATALOGO, modalidade } from './modalidades-de-teste.testing';

export const LB_PPI = modalidade({
  id: 'id-lb',
  codigo: 'LB_PPI',
  descricao: 'Cota PPI baixa renda',
  naturezaLegal: 'COTA_RESERVADA',
  composicaoVagas: 'DENTRO_DA_RESERVA_LEGAL',
  regraRemanejamento: 'SEGUE_CASCATA',
  regraDeAplicabilidade: [
    [{ fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'PARDA', 'INDIGENA'] }],
  ],
});
/** Modalidade institucional: fora do catálogo legal fixo, a regra se edita. */
export const BONUS = modalidade({
  id: 'id-bonus',
  codigo: 'AA_REGIONAL',
  legalFixa: false,
  descricao: 'Ação afirmativa regional',
  naturezaLegal: 'ACAO_AFIRMATIVA',
  composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  regraDeAplicabilidade: [
    [{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }],
    [{ fato: 'COR_RACA', operador: 'IGUAL', valor: 'INDIGENA' }],
  ],
});

/** A página do formulário de modalidade montada no TestBed, com o servidor simulado. */
export class PaginaDaModalidade {
  fixture!: ComponentFixture<ModalidadeFormPage>;
  edicao!: EdicaoDaModalidade;
  controller!: HttpTestingController;

  /** Modo criação por padrão (sem `id`); os testes de edição trocam a rota via `usarRota`. */
  constructor() {
    TestBed.configureTestingModule({
      imports: [ModalidadeFormPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'modalidades', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
      ],
    });
  }

  verificar(): void {
    this.controller.match(URL_CATALOGO).forEach((req) => req.flush([]));
    this.controller.verify();
  }

  /** Cria o componente sem responder a nenhuma requisição. */
  criar(): void {
    this.fixture = TestBed.createComponent(ModalidadeFormPage);
    this.edicao = this.fixture.debugElement.injector.get(EdicaoDaModalidade);
    this.controller = TestBed.inject(HttpTestingController);
  }

  /** Instancia o componente e libera o GET das modalidades vivas (selects de FK). */
  async montar(vivas: readonly ModalidadeDto[] = [AC, LB_PPI]): Promise<void> {
    this.criar();
    TestBed.tick();
    const req = this.controller.expectOne((r) => r.url === URL && r.params.get('limit') === '100');
    req.flush([...vivas]);
    await this.atualizar();
  }

  /** Reconfigura a rota para modo edição antes de montar. */
  usarRota(id: string): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
    });
  }

  /** Abre em edição a modalidade dada, com o catálogo de fatos carregado. */
  async editar(dto: ModalidadeDto): Promise<void> {
    this.usarRota(dto.id);
    await this.montar();
    this.controller.expectOne(`${URL}/${dto.id}`).flush(dto);
    TestBed.tick();
    this.controller.expectOne(URL_CATALOGO).flush([...CATALOGO]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.fixture.detectChanges();
  }

  /** Deixa as respostas pendentes chegarem e a tela refletir o que mudou. */
  async atualizar(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.fixture.detectChanges();
    TestBed.tick();
  }

  textoDaRegra(): string {
    const secao = this.fixture.nativeElement.querySelector(
      'section[aria-labelledby="cfg-mod-regra"]',
    ) as HTMLElement;
    return secao.textContent?.replace(/\s+/g, ' ') ?? '';
  }

  setControl(nome: string, valor: string): void {
    this.edicao.form.get(nome)?.setValue(valor);
  }
}
