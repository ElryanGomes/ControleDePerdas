"""
models.py — modelos SQLAlchemy do Controle de Perdas.
Três tabelas: fornecedores, produtos (catálogo) e perdas (lançamentos).
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


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
            'data': self.criado_em.isoformat(),
        }
