"""
models.py — modelos SQLAlchemy do Controle de Perdas.
Quatro tabelas: fornecedores, produtos (catálogo), perdas (lançamentos)
e meses (controle do mês aberto / fechado).
"""
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Horário de Brasília = UTC-3 (sem horário de verão desde 2019).
# criado_em é gravado em UTC; para saber o dia/mês "de verdade" convertemos.
FUSO_BRASILIA = timedelta(hours=-3)


def para_brasilia(dt_utc):
    return dt_utc + FUSO_BRASILIA


def mes_ref_de(dt_utc):
    """Datetime (UTC) -> 'AAAA-MM' no horário de Brasília."""
    return para_brasilia(dt_utc).strftime('%Y-%m')


def mes_seguinte(ref):
    """'2026-12' -> '2027-01'."""
    ano, mes = (int(x) for x in ref.split('-'))
    mes += 1
    if mes > 12:
        ano, mes = ano + 1, 1
    return f'{ano:04d}-{mes:02d}'


class Fornecedor(db.Model):
    __tablename__ = 'fornecedores'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(200), unique=True, nullable=False)

    produtos = db.relationship(
        'Produto', backref='fornecedor', cascade='all, delete-orphan', lazy=True
    )

    def to_dict(self):
        return {'id': self.id, 'nome': self.nome}


class Produto(db.Model):
    __tablename__ = 'produtos'

    id = db.Column(db.Integer, primary_key=True)
    fornecedor_id = db.Column(db.Integer, db.ForeignKey('fornecedores.id'), nullable=False)
    codigo_produto = db.Column(db.String(100))   # código usado no relatório para o RH
    codigo_barra = db.Column(db.String(100))     # código de barras (só para localizar rápido)
    descricao = db.Column(db.String(300), nullable=False)
    valor_unit = db.Column(db.Float, nullable=False, default=0)  # preço de compra

    def to_dict(self):
        return {
            'id': self.id,
            'fornecedor': self.fornecedor.nome,
            'codigoProduto': self.codigo_produto or '',
            'codigoBarra': self.codigo_barra or '',
            'descricao': self.descricao,
            'valorUnit': self.valor_unit,
        }


class Mes(db.Model):
    """Um registro por mês de trabalho. Só um fica ABERTO por vez; ao fechar,
    o mês vira somente leitura e o seguinte é aberto. Nada é apagado."""
    __tablename__ = 'meses'

    id = db.Column(db.Integer, primary_key=True)
    ref = db.Column(db.String(7), unique=True, nullable=False)   # 'AAAA-MM'
    status = db.Column(db.String(10), nullable=False, default='ABERTO')  # ABERTO | FECHADO
    aberto_em = db.Column(db.DateTime)
    fechado_em = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'ref': self.ref,
            'status': self.status,
            'abertoEm': self.aberto_em.isoformat() if self.aberto_em else None,
            'fechadoEm': self.fechado_em.isoformat() if self.fechado_em else None,
        }


class Perda(db.Model):
    __tablename__ = 'perdas'

    id = db.Column(db.Integer, primary_key=True)
    fornecedor = db.Column(db.String(200), nullable=False)
    descricao = db.Column(db.String(300), nullable=False)
    codigo = db.Column(db.String(100))
    tipo = db.Column(db.String(20), nullable=False)          # VENCIDO | AVARIADO
    quantidade = db.Column(db.Integer, nullable=False)
    validade = db.Column(db.String(50))                       # data ou "ILEGÍVEL"
    valor_unit = db.Column(db.Float, nullable=False)
    valor_total = db.Column(db.Float, nullable=False)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    mes_ref = db.Column(db.String(7), index=True)             # 'AAAA-MM' do mês em que foi lançada

    def to_dict(self):
        return {
            'id': self.id,
            'fornecedor': self.fornecedor,
            'descricao': self.descricao,
            'codigo': self.codigo or '',
            'tipo': self.tipo,
            'quantidade': self.quantidade,
            'validade': self.validade,
            'valorUnit': self.valor_unit,
            'valorTotal': self.valor_total,
            'data': self.criado_em.isoformat() if self.criado_em else None,
            # dia do registro no horário de Brasília (AAAA-MM-DD) — usar nos filtros de data
            'dataLocal': para_brasilia(self.criado_em).strftime('%Y-%m-%d') if self.criado_em else None,
            'mesRef': self.mes_ref,
        }

# ============================================================
# TROCAS e REBAIXAS
# Ficam em tabelas próprias, apontando para a Perda. Assim o mês
# fechado continua somente leitura, mas a troca pode ser pedida ou
# resolvida meses depois. Os valores contam no mês em que a PERDA foi
# lançada (Perda.mes_ref).
# ============================================================
class Troca(db.Model):
    """Um pedido de troca feito a um fornecedor (pode ter vários produtos)."""
    __tablename__ = 'trocas'

    id = db.Column(db.Integer, primary_key=True)
    fornecedor = db.Column(db.String(200), nullable=False, index=True)  # texto, igual à Perda
    status = db.Column(db.String(12), nullable=False, default='EM_ANALISE')  # EM_ANALISE | TROCADA | RECUSADA
    observacao = db.Column(db.String(500))
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    resolvido_em = db.Column(db.DateTime)

    itens = db.relationship(
        'TrocaItem', backref='troca', cascade='all, delete-orphan', lazy=True
    )


class TrocaItem(db.Model):
    """Quais perdas (e quantas unidades de cada) entram no pedido de troca.
    A troca é sempre pelo preço de COMPRA (Perda.valor_unit)."""
    __tablename__ = 'troca_itens'

    id = db.Column(db.Integer, primary_key=True)
    troca_id = db.Column(db.Integer, db.ForeignKey('trocas.id'), nullable=False, index=True)
    perda_id = db.Column(db.Integer, db.ForeignKey('perdas.id'), nullable=False, index=True)
    quantidade = db.Column(db.Integer, nullable=False)
    valor_unit = db.Column(db.Float, nullable=False)     # preço de compra na hora do pedido
    valor_total = db.Column(db.Float, nullable=False)

    perda = db.relationship('Perda', lazy='joined')


class Rebaixa(db.Model):
    """Um intervalo em que o produto foi vendido com preço reduzido.
    O mesmo produto pode ter várias rebaixas (várias linhas)."""
    __tablename__ = 'rebaixas'

    id = db.Column(db.Integer, primary_key=True)
    fornecedor = db.Column(db.String(200), nullable=False, index=True)
    descricao = db.Column(db.String(300), nullable=False)
    codigo = db.Column(db.String(100))
    preco_antigo = db.Column(db.Float, nullable=False)    # preço de VENDA original
    preco_novo = db.Column(db.Float, nullable=False)      # preço de VENDA rebaixado
    data_inicio = db.Column(db.Date, nullable=False)
    data_fim = db.Column(db.Date)                         # vazio = ainda em vigor
    qtd_promocao = db.Column(db.Integer, nullable=False, default=0)  # opcional: quantas unidades entraram na promoção
    qtd_vendida = db.Column(db.Integer, nullable=False, default=0)   # digitada à mão
    bonificacao = db.Column(db.String(12), nullable=False, default='PENDENTE')  # PENDENTE | SOLICITADA | RECEBIDA
    observacao = db.Column(db.String(500))
    perda_id = db.Column(db.Integer, db.ForeignKey('perdas.id'), nullable=True, index=True)  # vencido que sobrou (opcional)
    mes_ref = db.Column(db.String(7), index=True)         # 'AAAA-MM' de data_inicio
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    perda = db.relationship('Perda', lazy='joined')

    def to_dict(self):
        unit = round((self.preco_antigo or 0) - (self.preco_novo or 0), 2)
        vendida = self.qtd_vendida or 0
        promocao = self.qtd_promocao or 0
        perda = None
        if self.perda:
            perda = {
                'id': self.perda.id,
                'mesRef': self.perda.mes_ref,
                'quantidade': self.perda.quantidade,
                'validade': self.perda.validade,
                'tipo': self.perda.tipo,
            }
        return {
            'id': self.id,
            'fornecedor': self.fornecedor,
            'descricao': self.descricao,
            'codigo': self.codigo or '',
            'precoAntigo': self.preco_antigo,
            'precoNovo': self.preco_novo,
            'perdaUnit': unit,                                  # lucro perdido por unidade
            'dataInicio': self.data_inicio.isoformat() if self.data_inicio else None,
            'dataFim': self.data_fim.isoformat() if self.data_fim else None,
            'qtdPromocao': promocao,
            'qtdVendida': vendida,
            'sobra': max(promocao - vendida, 0) if promocao else 0,   # não vendeu -> virou vencido
            'perdaTotal': round(unit * vendida, 2),             # base da bonificação
            'bonificacao': self.bonificacao,
            'observacao': self.observacao or '',
            'perdaId': self.perda_id,
            'perda': perda,
            'mesRef': self.mes_ref,
        }
