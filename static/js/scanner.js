/* ============================================================
   Scanner — leitura de código de barras via câmera (html5-qrcode)
   ============================================================ */
const Scanner = (function(){
  let html5Qr = null;

  function open(onResult){
    const modal = document.getElementById('scannerModal');
    if(typeof Html5Qrcode === 'undefined'){
      Utils.toast('Leitor de código indisponível. Digite o código manualmente.');
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
        Utils.toast('Código lido: ' + decodedText);
      },
      () => {}
    ).catch(() => {
      Utils.toast('Não foi possível acessar a câmera.');
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

  return { open, close };
})();
