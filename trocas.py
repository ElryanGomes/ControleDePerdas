"""
trocas.py — Trocas com fornecedores e Rebaixas de preço (Blueprint do Flask).

Regras principais:
  * A troca é pedida sobre PERDAS já lançadas (uma perda pode ser trocada em partes).
  * Status do pedido: EM_ANALISE -> TROCADA ou RECUSADA. Recusada libera as unidades
    para um novo pedido.
  * Os valores contam no mês em que a PERDA foi lançada (Perda.mes_ref).
  * A troca é sempre pelo preço de compra (Perda.valor_unit).
  * Rebaixa: cada intervalo de preço reduzido é uma linha; a perda de lucro
    (preço antigo - novo) x vendidas é a base da bonificação cobrada do fornecedor.
"""
import re
from datetime import datetime

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from models import db, Perda, Troca, TrocaItem, Rebaixa, Mes, para_brasilia

bp_trocas = Blueprint('trocas', __name__)

REGEX_MES = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')
STATUS_TROCA = ('EM_ANALISE', 'TROCADA', 'RECUSADA')
STATUS_ATIVOS = ('EM_ANALISE', 'TROCADA')          # unidades "ocupadas" por um pedido
STATUS_BONIFICACAO = ('PENDENTE', 'SOLICITADA', 'RECEBIDA')


# ================= helpers =================
def _mes_param():
    """Lê ?mes= como o /api/perdas. Retorna (mes, erro): mes = 'AAAA-MM' ou None (= todos)."""
    mes = (request.args.get('mes') or '').strip()
    if mes.lower() == 'todos':
        return None, None
    if mes:
        if not REGEX_MES.match(mes):
            return None, (jsonify({'erro': 'Mês inválido. Use AAAA-MM ou "todos".'}), 400)
        return mes, None
    aberto = Mes.query.filter_by(status='ABERTO').first()
    return (aberto.ref if aberto else '0000-00'), None


def _uso_por_perda():
    """{perda_id: {'EM_ANALISE': n, 'TROCADA': n, 'RECUSADA': n}} (unidades em pedidos)."""
    q = (db.session.query(TrocaItem.perda_id, Troca.status, func.coalesce(func.sum(TrocaItem.quantidade), 0))
         .join(Troca, Troca.id == TrocaItem.troca_id)
         .group_by(TrocaItem.perda_id, Troca.status))
    uso = {}
    for perda_id, status, qtd in q.all():
        uso.setdefault(perda_id, {'EM_ANALISE': 0, 'TROCADA': 0, 'RECUSADA': 0})[status] = int(qtd)
    return uso


def _disponivel(perda, uso):
    u = uso.get(perda.id) or {}
    return perda.quantidade - u.get('EM_ANALISE', 0) - u.get('TROCADA', 0)


def _dia_local(dt):
    return para_brasilia(dt).strftime('%Y-%m-%d') if dt else None


def _troca_dict(t, mes=None):
    """Pedido com seus itens. Se `mes` for passado, mostra só os itens cuja perda é desse mês."""
    itens, ocultos = [], 0
    for i in t.itens:
        p = i.perda
        if mes and p.mes_ref != mes:
            ocultos += 1
            continue
        itens.append({
            'id': i.id,
            'perdaId': i.perda_id,
            'descricao': p.descricao,
            'codigo': p.codigo or '',
            'tipo': p.tipo,
            'validade': p.validade,
            'mesRef': p.mes_ref,
            'quantidade': i.quantidade,
            'valorUnit': i.valor_unit,
            'valorTotal': i.valor_total,
        })
    return {
        'id': t.id,
        'fornecedor': t.fornecedor,
        'status': t.status,
        'observacao': t.observacao or '',
        'criadoLocal': _dia_local(t.criado_em),
        'resolvidoLocal': _dia_local(t.resolvido_em),
        'itens': itens,
        'itensOcultos': ocultos,
        'quantidade': sum(i['quantidade'] for i in itens),
        'valorTotal': round(sum(i['valorTotal'] for i in itens), 2),
    }


# ---- usados pelo app.py para proteger as perdas ----
def perda_tem_troca_ativa(perda_id):
    """True se a perda está em pedido EM_ANALISE ou TROCADA."""
    achou = (db.session.query(TrocaItem.id)
             .join(Troca, Troca.id == TrocaItem.troca_id)
             .filter(TrocaItem.perda_id == perda_id, Troca.status.in_(STATUS_ATIVOS))
             .first())
    return achou is not None


def remover_vinculos_da_perda(perda_id):
    """Chamar antes de apagar uma perda (que não tem troca ativa): tira os itens de
    pedidos RECUSADOS, apaga pedidos que ficaram vazios e desvincula rebaixas."""
    itens = TrocaItem.query.filter_by(perda_id=perda_id).all()
    trocas_afetadas = {i.troca_id for i in itens}
    for i in itens:
        db.session.delete(i)
    db.session.flush()
    for tid in trocas_afetadas:
        if TrocaItem.query.filter_by(troca_id=tid).count() == 0:
            t = Troca.query.get(tid)
            if t:
                db.session.delete(t)
    Rebaixa.query.filter_by(perda_id=perda_id).update({Rebaixa.perda_id: None}, synchronize_session=False)
    db.session.flush()


# ================= trocas =================
@bp_trocas.route('/api/trocas/resumo', methods=['GET'])
def resumo():
    """Cards do topo da página (por mês da perda)."""
    mes, erro = _mes_param()
    if erro:
        return erro

    # perdas do mês
    q = db.session.query(Perda.tipo, func.coalesce(func.sum(Perda.quantidade), 0),
                         func.coalesce(func.sum(Perda.valor_total), 0))
    if mes:
        q = q.filter(Perda.mes_ref == mes)
    perdas = {'VENCIDO': {'quantidade': 0, 'valor': 0.0}, 'AVARIADO': {'quantidade': 0, 'valor': 0.0}}
    for tipo, qtd, val in q.group_by(Perda.tipo).all():
        if tipo in perdas:
            perdas[tipo] = {'quantidade': int(qtd), 'valor': round(float(val), 2)}

    # itens de troca, pelo mês da perda
    qi = (db.session.query(Troca.status, func.coalesce(func.sum(TrocaItem.quantidade), 0),
                           func.coalesce(func.sum(TrocaItem.valor_total), 0))
          .join(Troca, Troca.id == TrocaItem.troca_id)
          .join(Perda, Perda.id == TrocaItem.perda_id))
    if mes:
        qi = qi.filter(Perda.mes_ref == mes)
    trocas = {s: {'quantidade': 0, 'valor': 0.0} for s in STATUS_TROCA}
    for status, qtd, val in qi.group_by(Troca.status).all():
        trocas[status] = {'quantidade': int(qtd), 'valor': round(float(val), 2)}

    total_qtd = perdas['VENCIDO']['quantidade'] + perdas['AVARIADO']['quantidade']
    total_val = round(perdas['VENCIDO']['valor'] + perdas['AVARIADO']['valor'], 2)

    # rebaixas do mês
    qr = Rebaixa.query
    if mes:
        qr = qr.filter(Rebaixa.mes_ref == mes)
    reb_total = reb_cobrar = 0.0
    for r in qr.all():
        v = r.to_dict()['perdaTotal']
        reb_total += v
        if r.bonificacao != 'RECEBIDA':
            reb_cobrar += v

    return jsonify({
        'vencido': perdas['VENCIDO'],
        'avariado': perdas['AVARIADO'],
        'totalPerdas': {'quantidade': total_qtd, 'valor': total_val},
        'trocado': trocas['TROCADA'],
        'emAnalise': trocas['EM_ANALISE'],
        'recusado': trocas['RECUSADA'],
        'perdaLiquida': {'quantidade': total_qtd - trocas['TROCADA']['quantidade'],
                         'valor': round(total_val - trocas['TROCADA']['valor'], 2)},
        'rebaixa': {'perdaTotal': round(reb_total, 2), 'aCobrar': round(reb_cobrar, 2)},
    })


@bp_trocas.route('/api/trocas/pendentes', methods=['GET'])
def pendentes():
    """Perdas do mês agrupadas por fornecedor, com quanto está disponível / em análise / trocado."""
    mes, erro = _mes_param()
    if erro:
        return erro

    q = Perda.query
    if mes:
        q = q.filter(Perda.mes_ref == mes)
    perdas = q.all()
    perdas.sort(key=lambda p: (p.fornecedor.lower(), 0 if p.tipo == 'AVARIADO' else 1, p.descricao.lower()))

    uso = _uso_por_perda()
    grupos = {}
    for p in perdas:
        u = uso.get(p.id) or {}
        em = u.get('EM_ANALISE', 0)
        tr = u.get('TROCADA', 0)
        disp = max(p.quantidade - em - tr, 0)

        if disp == p.quantidade:
            status = 'DISPONIVEL'
        elif disp > 0:
            status = 'PARCIAL'
        elif em > 0:
            status = 'EM_ANALISE'
        else:
            status = 'TROCADO'

        g = grupos.setdefault(p.fornecedor, {
            'fornecedor': p.fornecedor, 'itens': [],
            'totalQtd': 0, 'totalValor': 0.0,
            'disponivelQtd': 0, 'disponivelValor': 0.0,
            'emAnaliseQtd': 0, 'emAnaliseValor': 0.0,
            'trocadoQtd': 0, 'trocadoValor': 0.0,
        })
        g['itens'].append({
            'perdaId': p.id, 'descricao': p.descricao, 'codigo': p.codigo or '', 'tipo': p.tipo,
            'validade': p.validade, 'mesRef': p.mes_ref,
            'quantidade': p.quantidade, 'valorUnit': p.valor_unit, 'valorTotal': p.valor_total,
            'disponivel': disp, 'emAnalise': em, 'trocado': tr, 'status': status,
        })
        g['totalQtd'] += p.quantidade
        g['totalValor'] += p.valor_total
        g['disponivelQtd'] += disp
        g['disponivelValor'] += disp * p.valor_unit
        g['emAnaliseQtd'] += em
        g['emAnaliseValor'] += em * p.valor_unit
        g['trocadoQtd'] += tr
        g['trocadoValor'] += tr * p.valor_unit

    saida = list(grupos.values())
    for g in saida:
        for k in ('totalValor', 'disponivelValor', 'emAnaliseValor', 'trocadoValor'):
            g[k] = round(g[k], 2)
    return jsonify(saida)


@bp_trocas.route('/api/trocas', methods=['GET'])
def listar_trocas():
    mes, erro = _mes_param()
    if erro:
        return erro
    q = Troca.query
    fornecedor = (request.args.get('fornecedor') or '').strip()
    status = (request.args.get('status') or '').strip().upper()
    if fornecedor:
        q = q.filter(Troca.fornecedor == fornecedor)
    if status:
        if status not in STATUS_TROCA:
            return jsonify({'erro': 'Status inválido.'}), 400
        q = q.filter(Troca.status == status)

    saida = []
    for t in q.order_by(Troca.criado_em.desc(), Troca.id.desc()).all():
        d = _troca_dict(t, mes)
        if d['itens']:
            saida.append(d)
    return jsonify(saida)


@bp_trocas.route('/api/trocas', methods=['POST'])
def criar_troca():
    """Cria um pedido de troca: {fornecedor, observacao, itens:[{perdaId, quantidade}]}"""
    data = request.get_json(force=True) or {}
    fornecedor = (data.get('fornecedor') or '').strip()
    observacao = (data.get('observacao') or '').strip()[:500]
    itens_in = data.get('itens') or []

    if not fornecedor:
        return jsonify({'erro': 'Fornecedor é obrigatório.'}), 400
    if not itens_in:
        return jsonify({'erro': 'Escolha pelo menos um produto para pedir a troca.'}), 400

    pedido = {}
    for it in itens_in:
        try:
            pid = int(it.get('perdaId'))
            qtd = int(it.get('quantidade'))
        except (TypeError, ValueError, AttributeError):
            return jsonify({'erro': 'Item inválido no pedido.'}), 400
        if qtd < 1:
            return jsonify({'erro': 'A quantidade de cada item deve ser de pelo menos 1.'}), 400
        pedido[pid] = pedido.get(pid, 0) + qtd

    perdas = {p.id: p for p in Perda.query.filter(Perda.id.in_(list(pedido))).all()}
    uso = _uso_por_perda()

    troca = Troca(fornecedor=fornecedor, status='EM_ANALISE', observacao=observacao or None)
    for pid, qtd in pedido.items():
        p = perdas.get(pid)
        if not p:
            return jsonify({'erro': f'Registro de perda {pid} não encontrado.'}), 404
        if p.fornecedor != fornecedor:
            return jsonify({'erro': f'"{p.descricao}" não é do fornecedor {fornecedor}.'}), 400
        disp = _disponivel(p, uso)
        if qtd > disp:
            return jsonify({'erro': f'"{p.descricao}": só há {max(disp, 0)} unidade(s) disponível(is) para troca.'}), 409
        troca.itens.append(TrocaItem(
            perda_id=p.id, quantidade=qtd, valor_unit=p.valor_unit,
            valor_total=round(qtd * p.valor_unit, 2),
        ))

    db.session.add(troca)
    db.session.commit()
    return jsonify(_troca_dict(troca))


TRANSICOES = {
    ('EM_ANALISE', 'TROCADA'), ('EM_ANALISE', 'RECUSADA'),
    ('TROCADA', 'EM_ANALISE'), ('RECUSADA', 'EM_ANALISE'),
}


@bp_trocas.route('/api/trocas/<int:troca_id>/status', methods=['PUT'])
def atualizar_status_troca(troca_id):
    troca = Troca.query.get_or_404(troca_id)
    data = request.get_json(force=True) or {}
    novo = (data.get('status') or '').strip().upper()
    if novo not in STATUS_TROCA:
        return jsonify({'erro': 'Status inválido.'}), 400

    atual = troca.status
    if novo == atual:
        return jsonify(_troca_dict(troca))
    if (atual, novo) not in TRANSICOES:
        return jsonify({'erro': 'Para mudar o resultado, primeiro volte o pedido para "em análise".'}), 409

    if atual == 'RECUSADA':
        # as unidades podem ter sido pedidas de novo em outro pedido enquanto isso
        uso = _uso_por_perda()
        for i in troca.itens:
            if i.quantidade > _disponivel(i.perda, uso):
                return jsonify({'erro': f'"{i.perda.descricao}" já foi pedido de novo em outra troca. '
                                        'Não dá para reabrir este pedido.'}), 409

    troca.status = novo
    troca.resolvido_em = datetime.utcnow() if novo in ('TROCADA', 'RECUSADA') else None
    db.session.commit()
    return jsonify(_troca_dict(troca))


@bp_trocas.route('/api/trocas/<int:troca_id>', methods=['DELETE'])
def excluir_troca(troca_id):
    troca = Troca.query.get_or_404(troca_id)
    if troca.status == 'TROCADA':
        return jsonify({'erro': 'Este pedido já foi trocado. Volte para "em análise" antes de excluir.'}), 409
    db.session.delete(troca)
    db.session.commit()
    return jsonify({'ok': True})


# ================= rebaixas =================
def _num(v, campo, tipo=float, vazio_ok=False):
    if v is None or v == '':
        if vazio_ok:
            return tipo(0)
        raise ValueError(f'{campo} é obrigatório.')
    try:
        return tipo(v)
    except (TypeError, ValueError):
        raise ValueError(f'{campo} inválido.')


def _data(v, campo, obrigatoria=True):
    v = (v or '').strip() if isinstance(v, str) else v
    if not v:
        if obrigatoria:
            raise ValueError(f'{campo} é obrigatória.')
        return None
    try:
        return datetime.strptime(str(v)[:10], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f'{campo} inválida.')


def _ler_rebaixa(data):
    """Valida o corpo da requisição. Retorna (campos, None) ou (None, mensagem_de_erro)."""
    fornecedor = (data.get('fornecedor') or '').strip()
    descricao = (data.get('descricao') or '').strip()
    if not fornecedor:
        return None, 'Fornecedor é obrigatório.'
    if not descricao:
        return None, 'Produto é obrigatório.'
    try:
        preco_antigo = _num(data.get('precoAntigo'), 'Preço antigo')
        preco_novo = _num(data.get('precoNovo'), 'Preço novo')
        qtd_vendida = _num(data.get('qtdVendida'), 'Quantidade vendida', int, vazio_ok=True)
        qtd_promocao = _num(data.get('qtdPromocao'), 'Quantidade na promoção', int, vazio_ok=True)
        inicio = _data(data.get('dataInicio'), 'Data de início')
        fim = _data(data.get('dataFim'), 'Data de fim', obrigatoria=False)
    except ValueError as e:
        return None, str(e)

    if preco_antigo <= 0:
        return None, 'O preço antigo deve ser maior que zero.'
    if preco_novo < 0 or preco_novo >= preco_antigo:
        return None, 'O preço novo deve ser menor que o preço antigo.'
    if qtd_vendida < 0 or qtd_promocao < 0:
        return None, 'As quantidades não podem ser negativas.'
    if qtd_promocao and qtd_vendida > qtd_promocao:
        return None, 'Vendidas não pode ser maior que a quantidade colocada na promoção.'
    if fim and fim < inicio:
        return None, 'A data de fim não pode ser antes da data de início.'

    perda_id = data.get('perdaId')
    if perda_id in (None, ''):
        perda_id = None
    else:
        try:
            perda_id = int(perda_id)
        except (TypeError, ValueError):
            return None, 'Perda vinculada inválida.'
        perda = Perda.query.get(perda_id)
        if not perda:
            return None, 'A perda vinculada não foi encontrada.'
        if perda.fornecedor != fornecedor:
            return None, 'A perda vinculada é de outro fornecedor.'

    return {
        'fornecedor': fornecedor,
        'descricao': descricao[:300],
        'codigo': (data.get('codigo') or '').strip()[:100],
        'preco_antigo': preco_antigo,
        'preco_novo': preco_novo,
        'data_inicio': inicio,
        'data_fim': fim,
        'qtd_promocao': qtd_promocao,
        'qtd_vendida': qtd_vendida,
        'observacao': (data.get('observacao') or '').strip()[:500] or None,
        'perda_id': perda_id,
        'mes_ref': inicio.strftime('%Y-%m'),
    }, None


@bp_trocas.route('/api/rebaixas', methods=['GET'])
def listar_rebaixas():
    """Rebaixas (pelo mês da data de início) + totais por fornecedor para cobrar a bonificação."""
    mes, erro = _mes_param()
    if erro:
        return erro
    q = Rebaixa.query
    if mes:
        q = q.filter(Rebaixa.mes_ref == mes)
    fornecedor = (request.args.get('fornecedor') or '').strip()
    if fornecedor:
        q = q.filter(Rebaixa.fornecedor == fornecedor)
    rebaixas = [r.to_dict() for r in q.order_by(Rebaixa.data_inicio.desc(), Rebaixa.id.desc()).all()]

    por_forn = {}
    totais = {'perdaTotal': 0.0, 'aCobrar': 0.0, 'recebido': 0.0, 'vendidas': 0}
    for r in rebaixas:
        g = por_forn.setdefault(r['fornecedor'], {'fornecedor': r['fornecedor'], 'perdaTotal': 0.0,
                                                  'aCobrar': 0.0, 'recebido': 0.0, 'vendidas': 0})
        for alvo in (g, totais):
            alvo['perdaTotal'] += r['perdaTotal']
            alvo['vendidas'] += r['qtdVendida']
            if r['bonificacao'] == 'RECEBIDA':
                alvo['recebido'] += r['perdaTotal']
            else:
                alvo['aCobrar'] += r['perdaTotal']

    lista = sorted(por_forn.values(), key=lambda g: g['fornecedor'].lower())
    for g in lista + [totais]:
        for k in ('perdaTotal', 'aCobrar', 'recebido'):
            g[k] = round(g[k], 2)
    return jsonify({'rebaixas': rebaixas, 'porFornecedor': lista, 'totais': totais})


@bp_trocas.route('/api/rebaixas', methods=['POST'])
def criar_rebaixa():
    campos, erro = _ler_rebaixa(request.get_json(force=True) or {})
    if erro:
        return jsonify({'erro': erro}), 400
    r = Rebaixa(bonificacao='PENDENTE', **campos)
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict())


@bp_trocas.route('/api/rebaixas/<int:rebaixa_id>', methods=['PUT'])
def atualizar_rebaixa(rebaixa_id):
    r = Rebaixa.query.get_or_404(rebaixa_id)
    campos, erro = _ler_rebaixa(request.get_json(force=True) or {})
    if erro:
        return jsonify({'erro': erro}), 400
    for k, v in campos.items():
        setattr(r, k, v)
    db.session.commit()
    return jsonify(r.to_dict())


@bp_trocas.route('/api/rebaixas/<int:rebaixa_id>/bonificacao', methods=['PUT'])
def atualizar_bonificacao(rebaixa_id):
    r = Rebaixa.query.get_or_404(rebaixa_id)
    status = ((request.get_json(force=True) or {}).get('status') or '').strip().upper()
    if status not in STATUS_BONIFICACAO:
        return jsonify({'erro': 'Status de bonificação inválido.'}), 400
    r.bonificacao = status
    db.session.commit()
    return jsonify(r.to_dict())


@bp_trocas.route('/api/rebaixas/<int:rebaixa_id>', methods=['DELETE'])
def excluir_rebaixa(rebaixa_id):
    r = Rebaixa.query.get_or_404(rebaixa_id)
    db.session.delete(r)
    db.session.commit()
    return jsonify({'ok': True})
