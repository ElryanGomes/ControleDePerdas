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