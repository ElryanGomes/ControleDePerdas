/* ============================================================
   Scanner — leitura de código de barras via câmera (html5-qrcode)
   + microinterações de leitura bem-sucedida (beep + flash),
   usadas tanto pela câmera quanto por leitores físicos (coletores)
   que digitam o código direto no campo.
   ============================================================ */
const Scanner = (function(){
  let html5Qr = null;
  let audioCtx = null;

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

  /* ---------- feedback visual (pisca de tela) ---------- */
  function flashSuccess(){
    const el = document.getElementById('scanCard') || document.body;
    el.classList.remove('scan-flash');
    void el.offsetWidth; // reinicia a animação se disparada em sequência rápida
    el.classList.add('scan-flash');
    setTimeout(() => el.classList.remove('scan-flash'), 450);
  }

  function feedbackSucesso(){
    beep();
    flashSuccess();
  }

  function open(onResult){
    const modal = document.getElementById('scannerModal');
    if(typeof Html5Qrcode === 'undefined'){
      Utils.toast('Leitor de código indisponível. Digite o código manualmente.', 'error');
      return;
    }
    modal.classList.add('open');

    html5Qr = new Html5Qrcode('reader', { formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,  Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.QR_CODE
    ]});

    html5Qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 140 } },
      (decodedText) => {
        onResult(decodedText);
        close();
        Utils.toast('Código lido: ' + decodedText, 'success');
      },
      () => {}
    ).catch(() => {
      Utils.toast('Não foi possível acessar a câmera.', 'error');
      modal.classList.remove('open');
    });
  }

  async function close(){
    document.getElementById('scannerModal').classList.remove('open');
    if(html5Qr){
      try{ await html5Qr.stop(); html5Qr.clear(); }catch(e){}
      html5Qr = null;
    }
  }

  document.getElementById('btnCancelScan')?.addEventListener('click', close);

  return { open, close, feedbackSucesso };
})();
