# Controle de Perdas — backend Flask + SQLAlchemy

Sistema para registrar perdas de produtos (vencidos/avariados), com catálogo de
fornecedores/produtos e leitura de código de barras. Os dados agora ficam
salvos em um **banco de dados de verdade** (SQLite por padrão, pode trocar
para MySQL), através do SQLAlchemy — não dependem mais do navegador.

## Estrutura

```
cp-flask/
├── app.py              → rotas Flask (API + página principal)
├── models.py             → modelos SQLAlchemy (Fornecedor, Produto, Perda)
├── requirements.txt
├── controle_perdas.db    → banco SQLite (criado automaticamente na 1ª execução)
├── templates/
│   └── index.html         → interface (front-end)
└── static/
    ├── css/                → estilos
    └── js/
        ├── utils.js
        ├── api.js           → toda comunicação com o backend (fetch)
        ├── state.js
        ├── scanner.js
        ├── page-registrar.js
        ├── page-relatorio.js
        ├── page-rankings.js
        ├── page-catalogo.js
        └── app.js
```

## Rodar localmente

```bash
pip install -r requirements.txt
python app.py
```

Abra **http://127.0.0.1:5000**. Um arquivo `controle_perdas.db` (SQLite) é
criado automaticamente na primeira execução, na mesma pasta do projeto.

## Deploy no PythonAnywhere

1. **Envie os arquivos**: crie uma conta, abra um **Bash console** e clone/faça
   upload do projeto (ex: `git clone` ou suba um `.zip` pela aba *Files* e
   depois `unzip nome.zip`). Anote o caminho, algo como:
   `/home/SEUUSUARIO/cp-flask`

2. **Crie um virtualenv e instale as dependências:**
   ```bash
   mkvirtualenv --python=/usr/bin/python3.10 cp-venv
   pip install -r /home/SEUUSUARIO/cp-flask/requirements.txt
   ```

3. **Aba "Web" → "Add a new web app" → Manual configuration → Python 3.10.**

4. Em **Virtualenv**, informe o caminho do virtualenv criado (ex:
   `/home/SEUUSUARIO/.virtualenvs/cp-venv`).

5. Edite o **arquivo WSGI** (link na própria aba Web) e substitua o conteúdo por:
   ```python
   import sys
   path = '/home/SEUUSUARIO/cp-flask'
   if path not in sys.path:
       sys.path.append(path)

   from app import app as application
   ```

6. (Opcional, recomendado) Em **Static files**, adicione um mapeamento:
   - URL: `/static/`
   - Directory: `/home/SEUUSUARIO/cp-flask/static/`

7. Clique em **Reload** no topo da aba Web. Pronto — o site já estará no ar
   no endereço `SEUUSUARIO.pythonanywhere.com`.

### Banco de dados

Por padrão o sistema usa **SQLite**, um arquivo (`controle_perdas.db`) salvo
na própria pasta do projeto — funciona bem para uso de uma loja/equipe pequena
e não exige nenhuma configuração extra.

Se preferir usar o **MySQL grátis do PythonAnywhere** (aba "Databases"),
defina a variável de ambiente `DATABASE_URL` antes de subir o app — por
exemplo, no início do arquivo WSGI:
```python
import os
os.environ['DATABASE_URL'] = 'mysql://SEUUSUARIO:SUASENHA@SEUUSUARIO.mysql.pythonanywhere-services.com/SEUUSUARIO$controle_perdas'
```
(seguido de `pip install pymysql` e `import pymysql; pymysql.install_as_MySQLdb()`
no topo do `app.py`, ou `pip install mysqlclient`).

## Como os dados fluem

- O front-end (`static/js/*.js`) nunca fala com o banco diretamente — tudo
  passa pela **API REST** em `app.py` (`/api/fornecedores`, `/api/produtos`,
  `/api/perdas`, `/api/catalogo`).
- Isso significa que **qualquer computador** acessando o endereço do
  PythonAnywhere vê os mesmos dados, em tempo real — diferente da versão
  anterior, que salvava só no navegador de cada pessoa.
