"""
app.py — Controle de Perdas (backend Flask + SQLAlchemy)

Rodar localmente:
    pip install -r requirements.txt
    python app.py
    -> abre em http://127.0.0.1:5000

Deploy no PythonAnywhere: veja README.md
"""
import os
from flask import Flask, request, jsonify, render_template
from models import db, Fornecedor, Produto, Perda

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)

# Por padrão usa SQLite (arquivo local). Para usar MySQL no PythonAnywhere,
# defina a variável de ambiente DATABASE_URL, por exemplo:
#   mysql://usuario:senha@usuario.mysql.pythonanywhere-services.com/usuario$controle_perdas
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///' + os.path.join(BASE_DIR, 'controle_perdas.db')
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()


def get_or_create_fornecedor(nome):
    nome = (nome or '').strip()
    fornecedor = Fornecedor.query.filter_by(nome=nome).first()
    if not fornecedor:
        fornecedor = Fornecedor(nome=nome)
        db.session.add(fornecedor)
        db.session.flush()  # garante fornecedor.id antes do commit
    return fornecedor


# ================= páginas =================
@app.route('/')
def index():
    return render_template('index.html')


# ================= fornecedores =================
@app.route('/api/fornecedores', methods=['GET'])
def listar_fornecedores():
    fornecedores = Fornecedor.query.order_by(Fornecedor.nome).all()
    return jsonify([f.nome for f in fornecedores])


@app.route('/api/fornecedores', methods=['POST'])
def criar_fornecedor():
    data = request.get_json(force=True) or {}
    nome = (data.get('nome') or '').strip()
    if not nome:
        return jsonify({'erro': 'Nome do fornecedor é obrigatório.'}), 400
    get_or_create_fornecedor(nome)
    db.session.commit()
    return jsonify({'ok': True})


# ================= catálogo (fornecedores + produtos agrupados) =================
@app.route('/api/catalogo', methods=['GET'])
def obter_catalogo():
    fornecedores = Fornecedor.query.order_by(Fornecedor.nome).all()
    catalogo = {f.nome: [p.to_dict() for p in f.produtos] for f in fornecedores}
    return jsonify(catalogo)


# ================= produtos =================
@app.route('/api/produtos', methods=['POST'])
def upsert_produto():
    """Cria o produto, ou atualiza se já existir (por código de barras ou código do produto,
    dentro do mesmo fornecedor)."""
    data = request.get_json(force=True) or {}
    fornecedor_nome = (data.get('fornecedor') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    if not fornecedor_nome:
        return jsonify({'erro': 'Fornecedor é obrigatório.'}), 400
    if not descricao:
        return jsonify({'erro': 'Descrição é obrigatória.'}), 400

    fornecedor = get_or_create_fornecedor(fornecedor_nome)
    codigo_barra = (data.get('codigoBarra') or '').strip()
    codigo_produto = (data.get('codigoProduto') or '').strip()
    valor_unit = float(data.get('valorUnit') or 0)

    produto = None
    if codigo_barra:
        produto = Produto.query.filter_by(fornecedor_id=fornecedor.id, codigo_barra=codigo_barra).first()
    if not produto and codigo_produto:
        produto = Produto.query.filter_by(fornecedor_id=fornecedor.id, codigo_produto=codigo_produto).first()

    if produto:
        produto.codigo_barra = codigo_barra
        produto.codigo_produto = codigo_produto
        produto.descricao = descricao
        produto.valor_unit = valor_unit
    else:
        produto = Produto(
            fornecedor_id=fornecedor.id, codigo_barra=codigo_barra,
            codigo_produto=codigo_produto, descricao=descricao, valor_unit=valor_unit,
        )
        db.session.add(produto)

    db.session.commit()
    return jsonify(produto.to_dict())


@app.route('/api/produtos/<int:produto_id>', methods=['PUT'])
def atualizar_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    data = request.get_json(force=True) or {}

    fornecedor_nome = (data.get('fornecedor') or '').strip()
    if fornecedor_nome:
        fornecedor = get_or_create_fornecedor(fornecedor_nome)
        produto.fornecedor_id = fornecedor.id

    descricao = (data.get('descricao') or '').strip()
    if not descricao:
        return jsonify({'erro': 'Descrição é obrigatória.'}), 400

    produto.codigo_barra = (data.get('codigoBarra') or '').strip()
    produto.codigo_produto = (data.get('codigoProduto') or '').strip()
    produto.descricao = descricao
    produto.valor_unit = float(data.get('valorUnit') or 0)

    db.session.commit()
    return jsonify(produto.to_dict())


@app.route('/api/produtos/<int:produto_id>', methods=['DELETE'])
def excluir_produto(produto_id):
    produto = Produto.query.get_or_404(produto_id)
    db.session.delete(produto)
    db.session.commit()
    return jsonify({'ok': True})


# ================= perdas =================
@app.route('/api/perdas', methods=['GET'])
def listar_perdas():
    query = Perda.query
    fornecedor = request.args.get('fornecedor')
    tipo = request.args.get('tipo')
    if fornecedor:
        query = query.filter_by(fornecedor=fornecedor)
    if tipo:
        query = query.filter_by(tipo=tipo)
    perdas = query.order_by(Perda.criado_em.desc()).all()
    return jsonify([p.to_dict() for p in perdas])


@app.route('/api/perdas', methods=['POST'])
def criar_perda():
    data = request.get_json(force=True) or {}
    fornecedor = (data.get('fornecedor') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    tipo = (data.get('tipo') or '').strip().upper()
    validade = (data.get('validade') or '').strip()

    try:
        quantidade = int(data.get('quantidade') or 0)
        valor_unit = float(data.get('valorUnit') or 0)
    except (TypeError, ValueError):
        return jsonify({'erro': 'Quantidade ou valor inválido.'}), 400

    if not fornecedor or not descricao or tipo not in ('VENCIDO', 'AVARIADO') or quantidade < 1 or not validade:
        return jsonify({'erro': 'Preencha todos os campos obrigatórios.'}), 400

    get_or_create_fornecedor(fornecedor)

    perda = Perda(
        fornecedor=fornecedor,
        descricao=descricao,
        codigo=(data.get('codigo') or '').strip(),
        tipo=tipo,
        quantidade=quantidade,
        validade=validade,
        valor_unit=valor_unit,
        valor_total=round(quantidade * valor_unit, 2),
    )
    db.session.add(perda)
    db.session.commit()
    return jsonify(perda.to_dict())


@app.route('/api/perdas/<int:perda_id>', methods=['DELETE'])
def excluir_perda(perda_id):
    perda = Perda.query.get_or_404(perda_id)
    db.session.delete(perda)
    db.session.commit()
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True)
