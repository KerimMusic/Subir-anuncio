import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp, onSnapshot,
  deleteDoc, doc, updateDoc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================
// ✅ TU CONFIG DE FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyDMabE70hIApcNU5RY3_WEEIF-BWUzO0K4",
  authDomain: "kerim-music-a9c46.firebaseapp.com",
  projectId: "kerim-music-a9c46",
  storageBucket: "kerim-music-a9c46.firebasestorage.app",
  messagingSenderId: "470731440209",
  appId: "1:470731440209:web:f6eba4784027a5d8c57870",
  measurementId: "G-LBHTKL8KDK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch(err =>
  console.warn('[WebView] Persistencia:', err)
);

// =============== WEBVIEW ===============
function esWebView() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const esAndroidWV = /android/.test(ua) && /(wv|version\/[\d.]+)/.test(ua);
  const esIOSWV = /iphone|ipad|ipod/.test(ua) && !/safari|crios|fxios|edgios/.test(ua);
  const tieneBridge = !!(window.Android || window.ReactNativeWebView ||
    (window.webkit && window.webkit.messageHandlers));
  return esAndroidWV || esIOSWV || tieneBridge;
}

getRedirectResult(auth).catch(err => {
  if (err?.code && err.code !== 'auth/no-auth-event') console.error(err);
});

// =============== DOM ===============
const loginSection  = document.getElementById('loginSection');
const appSection    = document.getElementById('appSection');
const loginBtn      = document.getElementById('loginBtn');
const logoutBtn     = document.getElementById('logoutBtn');
const userBox       = document.getElementById('userBox');
const userEmail     = document.getElementById('userEmail');
const status        = document.getElementById('status');

const formAnuncio       = document.getElementById('formAnuncio');
const submitAnuncioBtn  = document.getElementById('submitAnuncioBtn');
const previewAnuncioBtn = document.getElementById('previewAnuncioBtn');
const anunciosList      = document.getElementById('anunciosList');
const anunciosCount     = document.getElementById('anunciosCount');
const anunciosEmpty     = document.getElementById('anunciosEmpty');

// 🆕 Finalizados
const finalizadosSection = document.getElementById('finalizadosSection');
const finalizadosList    = document.getElementById('finalizadosList');
const finalizadosCount   = document.getElementById('finalizadosCount');
const finalizadosEmpty   = document.getElementById('finalizadosEmpty');

// Métricas
const metricAnuncios   = document.getElementById('metricAnuncios');
const metricVistas     = document.getElementById('metricVistas');
const metricEngagement = document.getElementById('metricEngagement');

// Modal preview
const previewModal = document.getElementById('previewModal');
const previewMedia = document.getElementById('previewMedia');
const previewImg   = document.getElementById('previewImg');
const previewTitle = document.getElementById('previewTitle');
const previewTimer = document.getElementById('previewTimer');

// Modal stats
const statsModal = document.getElementById('statsModal');
const statsList  = document.getElementById('statsList');
const statsEmpty = document.getElementById('statsEmpty');

// 🆕 Modal republicar
const republishModal     = document.getElementById('republishModal');
const republishTitle     = document.getElementById('republishTitle');
const republishDuracion  = document.getElementById('republishDuracion');
const republishIndefinido= document.getElementById('republishIndefinido');
const republishConfirmBtn= document.getElementById('republishConfirmBtn');

const COLECCION_ANUNCIOS = 'anuncios';
const COLECCION_VISITAS  = 'anuncios_vistas';
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1a1a2a"/>
  <text x="50%" y="54%" text-anchor="middle" fill="#6f6f88" font-size="26" font-family="sans-serif">📢</text>
</svg>`);

let usuarioActual       = null;
let unsubscribeAnuncios = null;
let anunciosActuales    = [];   // todos
let anunciosActivos     = [];   // solo activos
let anunciosFinalizados = [];   // solo finalizados
let republicandoId      = null; // ID del anuncio que se está republicando

// =============== Utilidades ===============
function toast(msg, tipo = 'ok') {
  status.textContent = msg;
  status.className = 'toast show ' + tipo;
  if (tipo === 'ok') {
    setTimeout(() => { status.className = 'toast'; }, 3500);
  } else if (tipo !== 'loading') {
    setTimeout(() => { status.className = 'toast'; }, 4500);
  }
}

function dropboxDirecto(url) {
  if (!url) return '';
  return url.trim()
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '').replace('?dl=1', '')
    .replace('&dl=0', '').replace('&dl=1', '')
    .replace('?raw=1', '');
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtNumero(n) { return (Number(n) || 0).toLocaleString('es-MX'); }

function fmtTiempo(seg) {
  if (!isFinite(seg) || seg < 0) return '0:00';
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function fmtFecha(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// 🆕 Determina si un anuncio está vencido
function estaVencido(ad) {
  if (!ad) return false;
  if (ad.esIndefinido) return false;
  if (!ad.fechaVencimientoMs) return false;
  return Date.now() >= ad.fechaVencimientoMs;
}

// 🆕 Texto de duración
function textoDuracion(ad) {
  if (ad.esIndefinido) return '∞ Indefinido';
  if (ad.duracionDias) return `${ad.duracionDias} día${ad.duracionDias === 1 ? '' : 's'}`;
  return '—';
}

// =============== Login ===============
loginBtn.addEventListener('click', async () => {
  try {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loader"></span>Conectando...';

    if (esWebView()) { await signInWithRedirect(auth, provider); return; }
    await signInWithPopup(auth, provider);
  } catch (e) {
    const fallback = ['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported'];
    if (fallback.includes(e.code)) {
      try { await signInWithRedirect(auth, provider); return; } catch(e2){ console.error(e2); }
    }
    toast('Error: ' + e.message, 'error');
    loginBtn.disabled = false;
    loginBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continuar con Google
    `;
  }
});

onAuthStateChanged(auth, (user) => {
  usuarioActual = user;

  if (user) {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userBox.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    userEmail.textContent = user.email;
    escucharAnuncios(user.uid);
  } else {
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    userBox.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    loginBtn.disabled = false;

    if (unsubscribeAnuncios) { unsubscribeAnuncios(); unsubscribeAnuncios = null; }
    anunciosList.innerHTML = '';
    finalizadosList.innerHTML = '';
    anunciosCount.textContent = '0';
    finalizadosCount.textContent = '0';
    anunciosEmpty.classList.add('hidden');
    finalizadosEmpty.classList.add('hidden');
    anunciosActuales = [];
    anunciosActivos = [];
    anunciosFinalizados = [];
    actualizarMetricas([], []);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    logoutBtn.disabled = true;
    await signOut(auth);
    toast('👋 Sesión cerrada', 'ok');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  } finally {
    logoutBtn.disabled = false;
  }
});

// ================================================================
// 🆕 CONTROLES DE DURACIÓN (form principal + modal republicar)
// ================================================================
function setupDurationControls(inputId, checkboxId) {
  const input    = document.getElementById(inputId);
  const checkbox = document.getElementById(checkboxId);
  const btns     = document.querySelectorAll(`.btn-num-dur[data-input="${inputId}"]`);

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (input.disabled) return;
      const step = parseInt(btn.dataset.step, 10) || 0;
      let val = parseInt(input.value, 10) || 1;
      val += step;
      if (val < 1) val = 1;
      if (val > 3650) val = 3650;
      input.value = val;
    });
  });

  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      input.dataset.savedValue = input.value;
      input.disabled = true;
      input.value = 0;
      btns.forEach(b => b.disabled = true);
    } else {
      input.disabled = false;
      btns.forEach(b => b.disabled = false);
      input.value = input.dataset.savedValue || 30;
      if (parseInt(input.value, 10) < 1) input.value = 30;
    }
  });
}

setupDurationControls('anuncioDuracion',   'anuncioIndefinido');
setupDurationControls('republishDuracion', 'republishIndefinido');

// =============== Botones +/- de repeticiones (sin cambios) ===============
document.querySelectorAll('.btn-num').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('anuncioRepeticiones');
    const step  = parseInt(btn.dataset.step, 10);
    let val = parseInt(input.value, 10) || 1;
    val += step;
    if (val < 1) val = 1;
    if (val > 999) val = 999;
    input.value = val;
  });
});

// =============== Guardar anuncio ===============
formAnuncio.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!usuarioActual) { toast('Debes iniciar sesión', 'error'); return; }

  const titulo       = document.getElementById('anuncioTitulo').value.trim();
  const audioRaw     = document.getElementById('anuncioAudio').value.trim();
  const imagenRaw    = document.getElementById('anuncioImagen').value.trim();
  const videoRaw     = document.getElementById('anuncioVideo').value.trim();
  const repeticiones = parseInt(document.getElementById('anuncioRepeticiones').value, 10) || 0;

  // 🆕 Duración
  const esIndefinido = document.getElementById('anuncioIndefinido').checked;
  const duracionDias = esIndefinido
    ? 0
    : (parseInt(document.getElementById('anuncioDuracion').value, 10) || 0);

  if (!titulo) { toast('Escribe un título', 'error'); return; }
  if (!audioRaw && !videoRaw) {
    toast('Coloca al menos URL de audio o de video', 'error');
    return;
  }
  if (repeticiones < 1) { toast('Repeticiones ≥ 1', 'error'); return; }
  if (!esIndefinido && duracionDias < 1) {
    toast('La duración debe ser ≥ 1 día o marca "Indefinido"', 'error');
    return;
  }

  const audioUrl  = audioRaw  ? dropboxDirecto(audioRaw)  : '';
  const imagenUrl = imagenRaw ? dropboxDirecto(imagenRaw) : '';
  const videoUrl  = videoRaw  ? dropboxDirecto(videoRaw)  : '';
  const tipo      = videoUrl ? 'video' : 'audio';

  // 🆕 Fechas en milisegundos para filtrar fácilmente
  const ahoraMs = Date.now();
  const fechaVencimientoMs = esIndefinido
    ? null
    : ahoraMs + (duracionDias * 24 * 60 * 60 * 1000);

  submitAnuncioBtn.disabled = true;
  submitAnuncioBtn.innerHTML = '<span class="loader"></span>Guardando...';
  toast('Guardando anuncio...', 'loading');

  try {
    await addDoc(collection(db, COLECCION_ANUNCIOS), {
      titulo, audioUrl, imagenUrl, videoUrl, tipo,
      repeticionesPorDia: repeticiones,

      // 🆕 Duración
      esIndefinido,
      duracionDias,
      fechaPublicacionMs:  ahoraMs,
      fechaVencimientoMs:  fechaVencimientoMs,

      totalVistas: 0,
      totalCompletadas: 0,
      totalSkips: 0,
      uid: usuarioActual.uid,
      email: usuarioActual.email,
      fecha: serverTimestamp()
    });

    toast('✅ Anuncio guardado', 'ok');
    formAnuncio.reset();
    document.getElementById('anuncioRepeticiones').value = 3;

    // 🆕 Reset controles de duración
    document.getElementById('anuncioDuracion').value = 30;
    document.getElementById('anuncioDuracion').disabled = false;
    document.getElementById('anuncioIndefinido').checked = false;
    document.querySelectorAll('.btn-num-dur[data-input="anuncioDuracion"]').forEach(b => b.disabled = false);
  } catch (err) {
    console.error(err);
    toast('Error: ' + err.message, 'error');
  } finally {
    submitAnuncioBtn.disabled = false;
    submitAnuncioBtn.textContent = 'Guardar anuncio';
  }
});

// =============== Vista previa ===============
let previewVideo = null;
let previewAudio = null;
let previewInt   = null;

function limpiarPreview() {
  if (previewVideo) { try { previewVideo.pause(); } catch(_){} previewVideo.src = ''; previewVideo = null; }
  if (previewAudio) { try { previewAudio.pause(); } catch(_){} previewAudio.src = ''; previewAudio = null; }
  if (previewInt)   { clearInterval(previewInt); previewInt = null; }
  previewMedia.innerHTML = '';
  previewTimer.textContent = '0:00';
}

function abrirPreview() {
  const titulo   = document.getElementById('anuncioTitulo').value.trim();
  const audioRaw = document.getElementById('anuncioAudio').value.trim();
  const imagenRaw= document.getElementById('anuncioImagen').value.trim();
  const videoRaw = document.getElementById('anuncioVideo').value.trim();

  if (!audioRaw && !videoRaw) {
    toast('Coloca URL de audio o video', 'error');
    return;
  }

  const audioUrl  = audioRaw  ? dropboxDirecto(audioRaw)  : '';
  const imagenUrl = imagenRaw ? dropboxDirecto(imagenRaw) : '';
  const videoUrl  = videoRaw  ? dropboxDirecto(videoRaw)  : '';

  limpiarPreview();
  previewTitle.textContent = titulo || 'Sin título';
  previewImg.src = imagenUrl || PLACEHOLDER;
  previewImg.onerror = () => { previewImg.onerror = null; previewImg.src = PLACEHOLDER; };

  if (videoUrl) {
    previewVideo = document.createElement('video');
    previewVideo.src = videoUrl;
    previewVideo.autoplay = true;
    previewVideo.playsInline = true;
    previewVideo.controls = true;
    previewMedia.appendChild(previewVideo);
    previewInt = setInterval(() => {
      if (previewVideo && isFinite(previewVideo.duration)) {
        previewTimer.textContent = `${fmtTiempo(previewVideo.currentTime)} / ${fmtTiempo(previewVideo.duration)}`;
      }
    }, 250);
  } else {
    const img = document.createElement('img');
    img.src = imagenUrl || PLACEHOLDER;
    img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
    previewMedia.appendChild(img);

    previewAudio = document.createElement('audio');
    previewAudio.src = audioUrl;
    previewAudio.autoplay = true;
    previewAudio.controls = true;
    previewMedia.appendChild(previewAudio);
    previewInt = setInterval(() => {
      if (previewAudio && isFinite(previewAudio.duration)) {
        previewTimer.textContent = `${fmtTiempo(previewAudio.currentTime)} / ${fmtTiempo(previewAudio.duration)}`;
      }
    }, 250);
  }

  previewModal.classList.remove('hidden');
}

function cerrarPreview() {
  limpiarPreview();
  previewModal.classList.add('hidden');
}

previewAnuncioBtn.addEventListener('click', abrirPreview);
previewModal.addEventListener('click', (e) => {
  if (e.target.dataset.close === 'preview') cerrarPreview();
});

// =============== Escuchar anuncios ===============
function escucharAnuncios(uid) {
  if (unsubscribeAnuncios) unsubscribeAnuncios();

  anunciosList.innerHTML = '<div class="empty-state"><span class="empty-icon">⏳</span><p>Cargando anuncios...</p></div>';

  unsubscribeAnuncios = onSnapshot(collection(db, COLECCION_ANUNCIOS), (snap) => {
    const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mios  = todos
      .filter(a => a.uid === uid)
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));

    // 🆕 Separar activos / finalizados
    const activos     = mios.filter(a => !estaVencido(a));
    const finalizados = mios.filter(a =>  estaVencido(a));

    anunciosActuales    = mios;
    anunciosActivos     = activos;
    anunciosFinalizados = finalizados;

    renderAnuncios(activos);
    renderFinalizados(finalizados);
    actualizarMetricas(activos, mios);
  }, (err) => {
    console.error(err);
    anunciosList.innerHTML = '';
    toast('Error al cargar: ' + err.message, 'error');
  });
}

// =============== Render activos ===============
function renderAnuncios(lista) {
  anunciosCount.textContent = lista.length;

  if (!lista.length) {
    anunciosList.innerHTML = '';
    anunciosEmpty.classList.remove('hidden');
    return;
  }
  anunciosEmpty.classList.add('hidden');

  anunciosList.innerHTML = lista.map(a => {
    const img    = a.imagenUrl ? escapeHtml(a.imagenUrl) : PLACEHOLDER;
    const titulo = escapeHtml(a.titulo || 'Sin título');
    const tipo   = a.tipo === 'video' ? '🎬 Video' : '🔊 Audio';
    const tagCls = a.tipo === 'video' ? 'tag-video' : 'tag-audio';
    const reps   = a.repeticionesPorDia || 0;
    const vistas = Number(a.totalVistas) || 0;

    // 🆕 Info de duración
    const duracion = a.esIndefinido
      ? '∞ Indefinido'
      : `📅 Vence: ${fmtFecha(a.fechaVencimientoMs)}`;

    return `
      <div class="ad-item" data-id="${escapeHtml(a.id)}">
        <img src="${img}" alt="" loading="lazy"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
        <div class="ad-item-info">
          <strong title="${titulo}">${titulo}</strong>
          <small>
            <span class="ad-type-tag ${tagCls}">${tipo}</span>
            <span>🔁 ${reps}/día</span>
            <span>👁️ ${fmtNumero(vistas)}</span>
            <span>${duracion}</span>
          </small>
        </div>
        <div class="ad-item-actions">
          <button type="button" class="btn-icon" data-action="preview" data-id="${escapeHtml(a.id)}" title="Vista previa">▶</button>
          <button type="button" class="btn-icon danger" data-action="delete" data-id="${escapeHtml(a.id)}" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// =============== 🆕 Render finalizados ===============
function renderFinalizados(lista) {
  finalizadosCount.textContent = lista.length;

  if (!lista.length) {
    finalizadosList.innerHTML = '';
    finalizadosEmpty.classList.remove('hidden');
    return;
  }
  finalizadosEmpty.classList.add('hidden');

  finalizadosList.innerHTML = lista.map(a => {
    const img    = a.imagenUrl ? escapeHtml(a.imagenUrl) : PLACEHOLDER;
    const titulo = escapeHtml(a.titulo || 'Sin título');
    const tipo   = a.tipo === 'video' ? '🎬 Video' : '🔊 Audio';
    const vistas = Number(a.totalVistas) || 0;
    const venc   = fmtFecha(a.fechaVencimientoMs);

    return `
      <div class="ad-item" data-id="${escapeHtml(a.id)}">
        <img src="${img}" alt="" loading="lazy"
             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
        <div class="ad-item-info">
          <strong title="${titulo}">${titulo}</strong>
          <small>
            <span class="ad-type-tag tag-expired">⏳ Finalizado</span>
            <span>${tipo}</span>
            <span>👁️ ${fmtNumero(vistas)}</span>
            <span>📅 ${venc}</span>
          </small>
        </div>
        <div class="ad-item-actions">
          <button type="button" class="btn-icon success" data-action="republish" data-id="${escapeHtml(a.id)}" title="Volver a publicar">🔄</button>
          <button type="button" class="btn-icon danger" data-action="delete-full" data-id="${escapeHtml(a.id)}" title="Eliminar completamente">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// =============== Click en activos ===============
anunciosList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const anuncio = anunciosActuales.find(a => a.id === id);
  if (!anuncio) return;

  if (btn.dataset.action === 'preview') {
    abrirPreviewDeAnuncio(anuncio);
    return;
  }

  if (btn.dataset.action === 'delete') {
    if (!confirm(`¿Eliminar completamente "${anuncio.titulo}"?\n\nSe borrarán TODOS sus datos incluyendo estadísticas y visitas.\n\nEsta acción no se puede deshacer.`)) return;
    try {
      btn.disabled = true;
      btn.textContent = '⏳';
      await eliminarAnuncioCompleto(id);
      toast('🗑️ Anuncio eliminado por completo', 'ok');
    } catch (err) {
      console.error(err);
      toast('Error: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '🗑️';
    }
  }
});

// =============== 🆕 Click en finalizados ===============
finalizadosList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const id = btn.dataset.id;
  const anuncio = anunciosActuales.find(a => a.id === id);
  if (!anuncio) return;

  if (btn.dataset.action === 'republish') {
    abrirRepublishModal(anuncio);
    return;
  }

  if (btn.dataset.action === 'delete-full') {
    if (!confirm(`¿Eliminar DEFINITIVAMENTE "${anuncio.titulo}"?\n\nSe borrarán:\n• El anuncio\n• Sus estadísticas\n• Todas sus visitas y contadores\n\nEsta acción no se puede deshacer.`)) return;
    try {
      btn.disabled = true;
      btn.textContent = '⏳';
      await eliminarAnuncioCompleto(id);
      toast('🗑️ Anuncio y todos sus datos eliminados', 'ok');
    } catch (err) {
      console.error(err);
      toast('Error: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '🗑️';
    }
  }
});

// ================================================================
// 🆕 ELIMINACIÓN COMPLETA
// Borra: doc del anuncio + todos los registros de visitas asociados
// ================================================================
async function eliminarAnuncioCompleto(anuncioId) {
  if (!anuncioId) throw new Error('ID inválido');

  // 1️⃣ Borrar todos los registros de visitas asociados
  try {
    const visitasSnap = await getDocs(collection(db, COLECCION_VISITAS));
    const promesas = [];

    visitasSnap.forEach(d => {
      const data = d.data() || {};
      const idCoincide     = d.id.startsWith(anuncioId + '_');
      const campoCoincide  = data.anuncioId === anuncioId;

      if (idCoincide || campoCoincide) {
        promesas.push(deleteDoc(d.ref));
      }
    });

    await Promise.all(promesas);
  } catch (e) {
    console.warn('Error al borrar visitas:', e);
    // Continuamos con el borrado del anuncio principal aunque falle
  }

  // 2️⃣ Borrar el documento principal del anuncio
  await deleteDoc(doc(db, COLECCION_ANUNCIOS, anuncioId));
}

// ================================================================
// 🆕 REPUBLICAR
// ================================================================
function abrirRepublishModal(anuncio) {
  republicandoId = anuncio.id;
  republishTitle.textContent = anuncio.titulo || 'Sin título';

  // Resetear controles
  republishIndefinido.checked = false;
  republishDuracion.disabled = false;
  republishDuracion.value = anuncio.duracionDias || 30;
  if (!republishDuracion.value || parseInt(republishDuracion.value, 10) < 1) {
    republishDuracion.value = 30;
  }
  document.querySelectorAll('.btn-num-dur[data-input="republishDuracion"]').forEach(b => b.disabled = false);

  republishModal.classList.remove('hidden');
}

function cerrarRepublishModal() {
  republishModal.classList.add('hidden');
  republicandoId = null;
}

republishModal.addEventListener('click', (e) => {
  if (e.target.dataset.close === 'republish') cerrarRepublishModal();
});

republishConfirmBtn.addEventListener('click', async () => {
  if (!republicandoId) return;

  const esIndefinido = republishIndefinido.checked;
  const duracionDias = esIndefinido
    ? 0
    : (parseInt(republishDuracion.value, 10) || 0);

  if (!esIndefinido && duracionDias < 1) {
    toast('La duración debe ser ≥ 1 día o marca "Indefinido"', 'error');
    return;
  }

  const ahoraMs = Date.now();
  const fechaVencimientoMs = esIndefinido
    ? null
    : ahoraMs + (duracionDias * 24 * 60 * 60 * 1000);

  republishConfirmBtn.disabled = true;
  republishConfirmBtn.innerHTML = '<span class="loader"></span>Publicando...';

  try {
    await updateDoc(doc(db, COLECCION_ANUNCIOS, republicandoId), {
      esIndefinido,
      duracionDias,
      fechaPublicacionMs:  ahoraMs,
      fechaVencimientoMs:  fechaVencimientoMs,
      fechaRepublicacion:  serverTimestamp()
    });

    toast('🔄 Anuncio publicado de nuevo', 'ok');
    cerrarRepublishModal();
  } catch (err) {
    console.error(err);
    toast('Error: ' + err.message, 'error');
  } finally {
    republishConfirmBtn.disabled = false;
    republishConfirmBtn.textContent = 'Publicar de nuevo';
  }
});

// =============== Preview desde un anuncio existente ===============
function abrirPreviewDeAnuncio(anuncio) {
  limpiarPreview();
  previewTitle.textContent = anuncio.titulo || 'Sin título';
  previewImg.src = anuncio.imagenUrl || PLACEHOLDER;
  previewImg.onerror = () => { previewImg.onerror = null; previewImg.src = PLACEHOLDER; };

  if (anuncio.tipo === 'video' && anuncio.videoUrl) {
    previewVideo = document.createElement('video');
    previewVideo.src = anuncio.videoUrl;
    previewVideo.autoplay = true;
    previewVideo.playsInline = true;
    previewVideo.controls = true;
    previewMedia.appendChild(previewVideo);
    previewInt = setInterval(() => {
      if (previewVideo && isFinite(previewVideo.duration)) {
        previewTimer.textContent = `${fmtTiempo(previewVideo.currentTime)} / ${fmtTiempo(previewVideo.duration)}`;
      }
    }, 250);
  } else {
    const img = document.createElement('img');
    img.src = anuncio.imagenUrl || PLACEHOLDER;
    img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
    previewMedia.appendChild(img);

    previewAudio = document.createElement('audio');
    previewAudio.src = anuncio.audioUrl;
    previewAudio.autoplay = true;
    previewAudio.controls = true;
    previewMedia.appendChild(previewAudio);
    previewInt = setInterval(() => {
      if (previewAudio && isFinite(previewAudio.duration)) {
        previewTimer.textContent = `${fmtTiempo(previewAudio.currentTime)} / ${fmtTiempo(previewAudio.duration)}`;
      }
    }, 250);
  }

  previewModal.classList.remove('hidden');
}

// =============== Métricas superiores ===============
function actualizarMetricas(activos, todos) {
  const totalActivos = (activos || []).length;
  let vistas = 0;
  let completadas = 0;

  (todos || activos || []).forEach(a => {
    vistas += Number(a.totalVistas) || 0;
    completadas += Number(a.totalCompletadas) || 0;
  });

  const engagement = vistas > 0 ? ((completadas / vistas) * 100).toFixed(1) + '%' : '0%';

  metricAnuncios.textContent   = fmtNumero(totalActivos);
  metricVistas.textContent     = fmtNumero(vistas);
  metricEngagement.textContent = engagement;
}

// Cerrar modales con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!previewModal.classList.contains('hidden'))   cerrarPreview();
    if (!statsModal.classList.contains('hidden'))     statsModal.classList.add('hidden');
    if (!republishModal.classList.contains('hidden')) cerrarRepublishModal();
  }
});
