"""
seed_demo.py — popula o banco com fornecedores, produtos e perdas
FICTÍCIOS, só para visualização/demonstração do sistema.

Rodar:
    python seed_demo.py

Não apaga nada que já existe: produtos são criados/atualizados por
código de barras, e novas perdas são sempre adicionadas.
"""
import random
from datetime import datetime, timedelta

from app import app, db
from models import Fornecedor, Produto, Perda

# fornecedor -> [(codigo_produto, codigo_barra, descricao, valor_unit), ...]
FORNECEDORES = {
    "M DIAS BRANCO": [
        ("32477", "7891234500017", "MACARRAO ESPAGUETE 500G", 4.21),
        ("32478", "7891234500024", "MACARRAO PARAFUSO 500G", 4.05),
        ("31022", "7891234500031", "FARINHA DE TRIGO 1KG", 3.60),
        ("30911", "7891234500048", "BOLACHA CREAM CRACKER 400G", 3.15),
    ],
    "NESTLE": [
        ("54012", "7891000100012", "LEITE NINHO 400G", 18.90),
        ("54099", "7891000100029", "NESCAU 400G", 9.50),
        ("54150", "7891000100036", "LEITE CONDENSADO 395G", 5.80),
        ("54201", "7891000100043", "CHOCOLATE KIT KAT 41G", 3.20),
    ],
    "UNILEVER": [
        ("71005", "7896000200018", "SABAO EM PO OMO 1KG", 14.50),
        ("71033", "7896000200025", "AMACIANTE COMFORT 1L", 11.20),
        ("71080", "7896000200032", "MAIONESE HELLMANNS 500G", 8.90),
        ("71145", "7896000200049", "SABONETE DOVE 90G", 2.75),
    ],
}

MOTIVOS = ["VENCIDO", "AVARIADO"]


def data_br(dt):
    return dt.strftime("%d/%m/%Y")


def run():
    with app.app_context():
        db.create_all()

        produtos_por_forn = {}
        for nome_forn, produtos in FORNECEDORES.items():
            fornecedor = Fornecedor.query.filter_by(nome=nome_forn).first()
            if not fornecedor:
                fornecedor = Fornecedor(nome=nome_forn)
                db.session.add(fornecedor)
                db.session.flush()

            lista = []
            for codigo_produto, codigo_barra, descricao, valor in produtos:
                produto = Produto.query.filter_by(
                    fornecedor_id=fornecedor.id, codigo_barra=codigo_barra
                ).first()
                if not produto:
                    produto = Produto(
                        fornecedor_id=fornecedor.id,
                        codigo_produto=codigo_produto,
                        codigo_barra=codigo_barra,
                        descricao=descricao,
                        valor_unit=valor,
                    )
                    db.session.add(produto)
                else:
                    produto.codigo_produto = codigo_produto
                    produto.descricao = descricao
                    produto.valor_unit = valor
                lista.append((codigo_produto, descricao, valor))
            produtos_por_forn[nome_forn] = lista

        db.session.commit()

        # perdas espalhadas nos últimos ~5 meses, para dar vida aos
        # Rankings e Gráficos
        hoje = datetime.utcnow()
        criadas = 0
        for nome_forn, produtos in produtos_por_forn.items():
            for codigo_produto, descricao, valor in produtos:
                for _ in range(random.randint(1, 2)):
                    tipo = random.choice(MOTIVOS)
                    quantidade = random.randint(2, 12)
                    dias_atras = random.randint(3, 150)
                    data_registro = hoje - timedelta(days=dias_atras)
                    validade_dt = data_registro + timedelta(days=random.randint(-20, 200))
                    validade = data_br(validade_dt) if random.random() > 0.08 else "ILEGÍVEL"

                    perda = Perda(
                        fornecedor=nome_forn,
                        descricao=descricao,
                        codigo=codigo_produto,
                        tipo=tipo,
                        quantidade=quantidade,
                        validade=validade,
                        valor_unit=valor,
                        valor_total=round(quantidade * valor, 2),
                        criado_em=data_registro,
                    )
                    db.session.add(perda)
                    criadas += 1

        db.session.commit()
        total_produtos = sum(len(v) for v in FORNECEDORES.values())
        print(f"Seed concluído: {len(FORNECEDORES)} fornecedores, "
              f"{total_produtos} produtos, {criadas} perdas fictícias.")


if __name__ == "__main__":
    run()
