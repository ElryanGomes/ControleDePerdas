# Rode na pasta do projeto (onde estão app.py, models.py e trocas.py):  python teste_trocas.py
# Usa um banco temporário; não mexe no seu controle_perdas.db.
import os, sys, tempfile
d = tempfile.mkdtemp()
os.environ['DATABASE_URL'] = 'sqlite:///' + os.path.join(d, 't.db')
sys.path.insert(0, os.getcwd())
from app import app, db
from models import Perda

c = app.test_client()
def ok(r, code=200):
    assert r.status_code == code, (r.status_code, r.get_json())
    return r.get_json()

# cria perdas
p1 = ok(c.post('/api/perdas', json=dict(fornecedor='NESTLE', descricao='LEITE', codigo='1', tipo='VENCIDO', quantidade=10, valorUnit=5, validade='01/01/2026')))
p2 = ok(c.post('/api/perdas', json=dict(fornecedor='NESTLE', descricao='NESCAU', codigo='2', tipo='AVARIADO', quantidade=4, valorUnit=10, validade='01/01/2027')))
mes = p1['mesRef']

r = ok(c.get('/api/trocas/resumo'))
assert r['totalPerdas']['valor'] == 90 and r['perdaLiquida']['valor'] == 90, r

# pedir troca de 6 de 10
t = ok(c.post('/api/trocas', json=dict(fornecedor='NESTLE', itens=[dict(perdaId=p1['id'], quantidade=6)])))
assert t['valorTotal'] == 30 and t['status'] == 'EM_ANALISE'
# passar do disponível
ok(c.post('/api/trocas', json=dict(fornecedor='NESTLE', itens=[dict(perdaId=p1['id'], quantidade=5)])), 409)
# fornecedor errado
ok(c.post('/api/trocas', json=dict(fornecedor='UNILEVER', itens=[dict(perdaId=p1['id'], quantidade=1)])), 400)

pend = ok(c.get('/api/trocas/pendentes'))
it = [i for g in pend for i in g['itens'] if i['perdaId'] == p1['id']][0]
assert (it['disponivel'], it['emAnalise'], it['status']) == (4, 6, 'PARCIAL'), it

# proteção da perda
ok(c.delete(f"/api/perdas/{p1['id']}"), 409)
ok(c.put(f"/api/perdas/{p1['id']}", json=dict(fornecedor='NESTLE', descricao='LEITE', tipo='VENCIDO', quantidade=3, valorUnit=5, validade='01/01/2026')), 409)
ok(c.put(f"/api/perdas/{p1['id']}", json=dict(fornecedor='NESTLE', descricao='LEITE NINHO', tipo='VENCIDO', quantidade=10, valorUnit=5, validade='01/01/2026')))

# trocada -> cards
ok(c.put(f"/api/trocas/{t['id']}/status", json=dict(status='TROCADA')))
r = ok(c.get('/api/trocas/resumo'))
assert r['trocado']['valor'] == 30 and r['perdaLiquida']['valor'] == 60 and r['emAnalise']['valor'] == 0, r
# TROCADA -> RECUSADA direto não pode
ok(c.put(f"/api/trocas/{t['id']}/status", json=dict(status='RECUSADA')), 409)
ok(c.delete(f"/api/trocas/{t['id']}"), 409)

# novo pedido do restante e recusa -> libera
t2 = ok(c.post('/api/trocas', json=dict(fornecedor='NESTLE', itens=[dict(perdaId=p1['id'], quantidade=4), dict(perdaId=p2['id'], quantidade=4)])))
r = ok(c.get('/api/trocas/resumo')); assert r['emAnalise']['valor'] == 60, r
ok(c.put(f"/api/trocas/{t2['id']}/status", json=dict(status='RECUSADA')))
pend = ok(c.get('/api/trocas/pendentes'))
it = [i for g in pend for i in g['itens'] if i['perdaId'] == p2['id']][0]
assert it['disponivel'] == 4
# lista com filtro de mês
assert len(ok(c.get(f'/api/trocas?mes={mes}'))) == 2
assert len(ok(c.get('/api/trocas?mes=2020-01'))) == 0
assert len(ok(c.get('/api/trocas?status=RECUSADA'))) == 1

# rebaixa
rb = ok(c.post('/api/rebaixas', json=dict(fornecedor='NESTLE', descricao='LEITE NINHO', codigo='1', precoAntigo=5, precoNovo=4,
        dataInicio='2026-10-01', dataFim='2026-10-10', qtdPromocao=10, qtdVendida=7, perdaId=p1['id'])))
assert rb['perdaUnit'] == 1 and rb['perdaTotal'] == 7 and rb['sobra'] == 3 and rb['mesRef'] == '2026-10'
ok(c.post('/api/rebaixas', json=dict(fornecedor='NESTLE', descricao='X', precoAntigo=5, precoNovo=6, dataInicio='2026-10-01')), 400)
ok(c.post('/api/rebaixas', json=dict(fornecedor='NESTLE', descricao='X', precoAntigo=5, precoNovo=4, dataInicio='2026-10-10', dataFim='2026-10-01')), 400)
ok(c.post('/api/rebaixas', json=dict(fornecedor='UNILEVER', descricao='X', precoAntigo=5, precoNovo=4, dataInicio='2026-10-10', perdaId=p1['id'])), 400)
ok(c.put(f"/api/rebaixas/{rb['id']}/bonificacao", json=dict(status='SOLICITADA')))
l = ok(c.get('/api/rebaixas?mes=2026-10'))
assert l['totais']['aCobrar'] == 7 and l['porFornecedor'][0]['perdaTotal'] == 7
ok(c.put(f"/api/rebaixas/{rb['id']}/bonificacao", json=dict(status='RECEBIDA')))
l = ok(c.get('/api/rebaixas?mes=2026-10'))
assert l['totais']['aCobrar'] == 0 and l['totais']['recebido'] == 7
r = ok(c.get('/api/trocas/resumo?mes=2026-10')); assert r['rebaixa']['perdaTotal'] == 7

# renomear fornecedor propaga
ok(c.put('/api/fornecedores/NESTLE', json=dict(nome='NESTLÉ')))
assert ok(c.get('/api/rebaixas?mes=2026-10'))['rebaixas'][0]['fornecedor'] == 'NESTLÉ'
assert ok(c.get('/api/trocas'))[0]['fornecedor'] == 'NESTLÉ'

# excluir perda sem troca ativa (p2 só tem item recusado) limpa vínculos
ok(c.delete(f"/api/perdas/{p2['id']}"))
assert len(ok(c.get('/api/trocas'))) == 2  # t2 ainda tem item de p1
# t2 recusada, p1 tem troca ativa (t); apagar t2 e conferir
ok(c.delete(f"/api/trocas/{t2['id']}"))
print('TUDO OK')
