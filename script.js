import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

    const firebaseConfig = {
    apiKey: "AIzaSyBxyOjXw1IsFp6YJVh3RXxNQy2wtS9Ujbk",
    authDomain: "restaurante-5b7f0.firebaseapp.com",
    projectId: "restaurante-5b7f0",
    storageBucket: "restaurante-5b7f0.firebasestorage.app",
    messagingSenderId: "645614966793",
    appId: "1:645614966793:web:426f615c6751d0951f40d8"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const marmitex = [
    { id:1,  nome:"Marmitex feijoada pequeno",     desc:"Arroz, feijoada, lasanha de carne, salpicão, batata frita",    preco:18.00 },
    { id:2,  nome:"Marmitex feijoada média",    desc:"Arroz, feijoada, lasanha de carne, salpicão, batata frita",    preco:20.00 },
    { id:3,  nome:"Marmitex feijoada grande",     desc:"Arroz, feijoada, lasanha de carne, salpicão, batata frita",    preco:22.00 },
    { id:4,  nome:"Marmitex feijão tropeiro pequeno",        desc:"Arroz, feijão tropeiro, lasanha de carne, salpicão, batata frita", preco:18.00 },
    { id:5,  nome:"Marmitex feijão tropeiro médio",           desc:"Arroz, feijão tropeiro, lasanha de carne, salpicão, batata frita",     preco:20.00 },
    { id:6,  nome:"Marmitex feijão tropeiro grande",        desc:"Arroz, feijão tropeiro, lasanha de carne, salpicão, batata frita",     preco:22.00 },
];
const bebidas = [
    { id:10, nome:"Coca-Cola",    desc:"2L",     preco:12.00 },
];

let carrinho = [];
let intervalsPorId = {};

function renderLista(lista, containerId) {
    document.getElementById(containerId).innerHTML = lista.map(item => `
        <div class="item-cardapio">
            <div class="item-info">
                <div class="item-nome">${item.nome}</div>
                <div class="item-desc">${item.desc}</div>
            </div>
            <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0">
                <span class="item-preco">R$ ${item.preco.toFixed(2).replace('.',',')}</span>
                <div class="item-controles">
                    <button class="qtd-btn" onclick="mudarQtd(${item.id},-1)">−</button>
                    <span class="qtd-num" id="qtd-${item.id}">0</span>
                    <button class="qtd-btn" onclick="mudarQtd(${item.id},1)">+</button>
                </div>
            </div>
        </div>`).join('');
}
renderLista(marmitex, 'lista-marmitex');
renderLista(bebidas,  'lista-bebidas');

window.mudarQtd = (id, delta) => {
    const prod = [...marmitex,...bebidas].find(p=>p.id===id);
    const idx  = carrinho.findIndex(c=>c.id===id);
    if (idx === -1) { if (delta > 0) carrinho.push({...prod, qtd:1}); }
    else {
        carrinho[idx].qtd += delta;
        if (carrinho[idx].qtd <= 0) carrinho.splice(idx,1);
    }
    atualizarCarrinho();
};

function atualizarCarrinho() {
    [...marmitex,...bebidas].forEach(p => {
        const el = document.getElementById('qtd-'+p.id);
        if (el) el.textContent = carrinho.find(c=>c.id===p.id)?.qtd || 0;
    });
    const lista      = document.getElementById('lista-carrinho-itens');
    const totalLinha = document.getElementById('total-linha');
    if (!carrinho.length) {
        lista.innerHTML = '<p style="color:#999">Nenhum item adicionado ainda.</p>';
        totalLinha.style.display = 'none';
        return;
    }
    const total = carrinho.reduce((s,i)=>s+i.preco*i.qtd, 0);
    lista.innerHTML = carrinho.map(i=>`
        <div class="carrinho-item-linha">
            <span>${i.qtd}× ${i.nome}</span>
            <span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span>
        </div>`).join('');
    document.getElementById('total-valor').textContent = total.toFixed(2).replace('.',',');
    totalLinha.style.display = 'block';
}

window.confirmarPedido = async () => {
    const nome = document.getElementById('nomeCliente').value.trim();
    if (!nome)            { showToast('Informe seu nome antes de pedir ⚠️'); return; }
    if (!carrinho.length) { showToast('Adicione itens ao carrinho ⚠️'); return; }

    const btn = document.getElementById('btn-pedir');
    btn.disabled = true; btn.textContent = 'Enviando...';

    try {
        const obs = document.getElementById('obs-pedido').value.trim();
        const ref = await addDoc(collection(db,'pedidos'), {
            cliente: nome,
            tipo: 'balcao',
            observacoes: obs,
            itens: carrinho.map(i=>({id:i.id, nome:i.nome, qtd:i.qtd, preco:i.preco})),
            total: carrinho.reduce((s,i)=>s+i.preco*i.qtd, 0),
            status: 'pendente',
            criadoEm: serverTimestamp()
        });

        const salvos = JSON.parse(localStorage.getItem('pedidos') || '[]');
        salvos.push(ref.id);
        localStorage.setItem('pedidos', JSON.stringify(salvos));

        carrinho = [];
        atualizarCarrinho();
        document.getElementById('obs-pedido').value = '';
        document.getElementById('modalConfirmacao').classList.add('open');
        iniciarAcompanhamento(ref.id);
    } catch(e) {
        showToast('Erro ao enviar pedido. Tente novamente.');
        console.error(e);
    }

    btn.disabled = false; btn.textContent = 'Fazer Pedido';
};

window.fecharModal = () => {
    document.getElementById('modalConfirmacao').classList.remove('open');
    document.getElementById('secao-status').scrollIntoView({ behavior:'smooth' });
};

const passos      = ['pendente','preparando','pronto','entregue'];
const passosLabel = ['⏳ Aguardando','👨‍🍳 Preparando','✅ Pronto!','📦 Retirado'];
const statusLabel = { pendente:'⏳ Aguardando', preparando:'👨‍🍳 Preparando', pronto:'✅ Pronto para retirar!', entregue:'📦 Retirado' };
const statusClass = { pendente:'s-pendente', preparando:'s-preparando', pronto:'s-pronto', entregue:'s-entregue' };

function iniciarAcompanhamento(id) {
    document.getElementById('secao-status').style.display = 'block';
    buscarStatus(id);
    if (intervalsPorId[id]) clearInterval(intervalsPorId[id]);
    intervalsPorId[id] = setInterval(() => buscarStatus(id), 3000);
}

async function buscarStatus(id) {
    try {
        const snap = await getDoc(doc(db,'pedidos', id));
        if (!snap.exists()) return;
        const d = snap.data();
        renderStatus(id, d);
        if (d.status === 'entregue') {
            clearInterval(intervalsPorId[id]);
            delete intervalsPorId[id];
            const salvos = JSON.parse(localStorage.getItem('pedidos') || '[]');
            localStorage.setItem('pedidos', JSON.stringify(salvos.filter(i => i !== id)));
        }
    } catch(e) { console.error(e); }
}

function renderStatus(id, d) {
    const idxAtual = passos.indexOf(d.status);
    const progressoHTML = passos.map((p,i) => {
        let cls = '';
        if (i < idxAtual)   cls = 'concluido';
        if (i === idxAtual) cls = 'ativo';
        return `<div class="passo ${cls}">${passosLabel[i]}</div>`;
    }).join('');

    const agora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

    let bloco = document.getElementById('status-' + id);
    if (!bloco) {
        bloco = document.createElement('div');
        bloco.id = 'status-' + id;
        document.getElementById('area-status').appendChild(bloco);
    }

    bloco.innerHTML = `
        <div class="status-pedido-card">
            <div class="status-topo">
                <strong>${d.cliente}</strong>
                <span class="status-badge ${statusClass[d.status]||'s-pendente'}">${statusLabel[d.status]||d.status}</span>
            </div>
            <div class="progresso">${progressoHTML}</div>
            <hr class="divisor">
            ${d.itens.map(i=>`
                <div class="carrinho-item-linha">
                    <span>${i.qtd}× ${i.nome}</span>
                    <span>R$ ${(i.preco*i.qtd).toFixed(2).replace('.',',')}</span>
                </div>`).join('')}
            <p style="font-weight:bold;margin-top:.4rem">Total: R$ ${d.total.toFixed(2).replace('.',',')}</p>
            ${d.observacoes ? `<p style="font-size:.85rem;color:#777;margin-top:.4rem">Obs: ${d.observacoes}</p>` : ''}
            <p class="atualizado-em">Atualizado às ${agora}</p>
        </div>
        ${d.status === 'entregue' ? `<p style="text-align:center;color:#2d4a2b;font-weight:bold;margin-top:.5rem">Obrigado pela preferência! 🙏</p>` : ''}
    `;
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 2500);
}

// recuperar pedidos ao reabrir o site
const pedidosSalvos = JSON.parse(localStorage.getItem('pedidos') || '[]');
if (pedidosSalvos.length) {
    document.getElementById('secao-status').style.display = 'block';
    pedidosSalvos.forEach(id => iniciarAcompanhamento(id));
}