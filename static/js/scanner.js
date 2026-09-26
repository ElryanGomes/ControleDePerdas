/* ============================================================
   Scanner — leitura de código de barras via câmera (html5-qrcode)
   + microinterações de leitura bem-sucedida (beep + ícone verde),
   lanterna, galeria e leitura otimizada para códigos rápidos e acurados.
   ============================================================ */
const Scanner = (function(){
  let html5Qr = null;
  let audioCtx = null;
  let torchActive = false;

  /* ---------- feedback sonoro ---------- */
  function beep(){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.13);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.14);
    }catch(e){ /* áudio indisponível — silencioso, sem quebrar o fluxo */ }
  }

  /* ---------- feedback visual: ícone verde flutuante ---------- */
  function showSuccessIcon(){
    const icon = document.createElement('div');
    icon.className = 'scan-success-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="11" opacity="0.15"></circle>
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
      </svg>
    `;
    document.body.appendChild(icon);
    setTimeout(() => icon.remove(), 1200);
  }

  function feedbackSucesso(){
    beep();
    showSuccessIcon();
  }

  /* ---------- alternar flash/lanterna ---------- */
  async function toggleTorch(){
    if(!html5Qr) return;
    try{
      const constraints = { advanced: [{ torch: !torchActive }] };
      await html5Qr.applyConstraints({ advanced: [{ torch: !torchActive }] });
      torchActive = !torchActive;
      const btn = document.getElementById('btnTorchScan');
      if(btn){
        btn.classList.toggle('active', torchActive);
        btn.textContent = torchActive ? '💡 Off' : '💡';
      }
    }catch(e){
      Utils.toast('Lanterna não disponível neste dispositivo.', 'info');
    }
  }

  /* ---------- ler arquivo de galeria ---------- */
  function readFromGallery(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if(!file || !html5Qr) return;
      try{
        const result = await html5Qr.scanFile(file, true);
        const onResult = window._scannerCallback;
        if(onResult && result){
          onResult(result);
          close();
          Utils.toast('Código lido: ' + result, 'success');
        } else {
          Utils.toast('Nenhum código detectado nesta imagem.', 'error');
        }
      }catch(err){
        Utils.toast('Nenhum código detectado nesta imagem.', 'error');
      }
    });
    input.click();
  }

  function open(onResult){
    window._scannerCallback = onResult;
    const modal = document.getElementById('scannerModal');
    if(typeof Html5Qrcode === 'undefined'){
      Utils.toast('Leitor de código indisponível. Digite o código manualmente.', 'error');
      return;
    }
    modal.classList.add('open');
    torchActive = false;

    html5Qr = new Html5Qrcode('reader', { 
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,  Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93, Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.ITF
      ],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });

    const qrboxSize = Math.min(Math.min(window.innerWidth - 40, 380), Math.min(window.innerHeight - 200, 500));
    
    html5Qr.start(
      { facingMode: 'environment', torch: false },
      { 
        fps: 30,           // aumentar FPS — leitura mais rápida
        qrbox: {
          width: qrboxSize,
          height: qrboxSize
        },
        aspectRatio: 1.0,
        disableFlip: false
      },
      (decodedText) => {
        onResult(decodedText);
        close();
        Utils.toast('Código lido: ' + decodedText, 'success');
      },
      () => {} // sem logs
    ).catch(() => {
      Utils.toast('Não foi possível acessar a câmera.', 'error');
      modal.classList.remove('open');
    });

    // bind dos botões
    const btnTorch = document.getElementById('btnTorchScan');
    const btnGallery = document.getElementById('btnGalleryScan');
    const btnCancel = document.getElementById('btnCancelScan');
    
    if(btnTorch) btnTorch.addEventListener('click', toggleTorch);
    if(btnGallery) btnGallery.addEventListener('click', readFromGallery);
    if(btnCancel) btnCancel.addEventListener('click', close);
  }

  async function close(){
    const modal = document.getElementById('scannerModal');
    if(modal) modal.classList.remove('open');
    if(html5Qr){
      try{ await html5Qr.stop(); html5Qr.clear(); }catch(e){}
      html5Qr = null;
    }
    torchActive = false;
    window._scannerCallback = null;
  }

  return { open, close, feedbackSucesso };
})();