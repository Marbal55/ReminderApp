import { supabase } from './supabase-config.js';

// === CONFIGURACIÓN DEL LOCAL ===
// PEGA AQUÍ EL UUID DE TU LOCAL
const LOCAL_ID = '08cf0040-6b40-4ba9-848d-17c1184f0cce'; 

const searchSection = document.getElementById('search-section');
const controlPanel = document.getElementById('control-panel');
const txtNombre = document.getElementById('cliente-nombre');
const txtSellos = document.getElementById('cliente-sellos');

const btnScan = document.getElementById('btn-scan');
const btnCancelScan = document.getElementById('btn-cancel-scan');
const readerDiv = document.getElementById('reader');

const btnSumar = document.getElementById('btn-sumar');
const btnRestar = document.getElementById('btn-restar');
const btnCanjear = document.getElementById('btn-canjear');
const btnCerrar = document.getElementById('btn-cerrar-cliente');

let clienteActual = null;
let fidelizacionActual = null;
let html5QrCode = null;


// === VALIDACIÓN DE ESTADO DEL LOCAL ===
async function comprobarEstadoLocal() {
    try {
        const { data: local, error } = await supabase
            .from('locales')
            .select('activo, nombre')
            .eq('id', LOCAL_ID)
            .single();

        if (error) throw error;

        if (local.activo === false) {
            // Reemplazar la interfaz de escaneo por una alerta de bloqueo
            searchSection.innerHTML = `
                <div class="text-center p-6 bg-red-500/10 border border-red-500/50 rounded-2xl w-full">
                    <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h2 class="text-xl font-extrabold text-red-500 mb-2 uppercase">Servicio Suspendido</h2>
                    <p class="text-sm text-reminder-gray mb-6">El sistema para <strong>${local.nombre}</strong> ha sido pausado. No se pueden escanear clientes ni registrar visitas.</p>
                    <a href="mailto:soporteitmsg@gmail.com" class="bg-red-500 text-black font-extrabold px-6 py-3 rounded-xl inline-block hover:bg-red-400 transition-colors uppercase tracking-wide text-sm">Contactar con Soporte</a>
                </div>
            `;
        } else {
            // Extra: Si está activo, actualizamos el nombre del header dinámicamente con el dato real de la base de datos
            document.querySelector('header p').textContent = local.nombre + ' Barber Club';
        }
    } catch (error) {
        console.error('Error al verificar el estado del local:', error);
    }
}

// Ejecutar la comprobación nada más abrir la app del barbero
comprobarEstadoLocal();


// 1. Iniciar Escáner de QR
btnScan.addEventListener('click', () => {
    readerDiv.classList.remove('hidden');
    btnScan.classList.add('hidden');
    btnCancelScan.classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Activa la cámara trasera ('environment') por defecto
    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
    .catch(err => {
        alert('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        detenerEscaner();
    });
});

btnCancelScan.addEventListener('click', detenerEscaner);

function detenerEscaner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(err => console.log(err));
    }
    readerDiv.classList.add('hidden');
    btnScan.classList.remove('hidden');
    btnCancelScan.classList.add('hidden');
}

function onScanFailure(error) {
    // Esta función se ejecuta constantemente mientras la cámara busca un QR válido.
}

// 2. Procesar el QR leído
async function onScanSuccess(decodedText, decodedResult) {
    detenerEscaner(); // Apagamos la cámara al instante
    const hash = decodedText; // El texto oculto en el QR

    try {
        // A) Localizar al usuario en la BD
        const { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('id, nombre, apellidos')
            .eq('qr_hash', hash)
            .single();

        if (errCliente) throw new Error('Cliente no encontrado en el sistema.');
        clienteActual = cliente;

        // B) Buscar si ya tiene tarjeta en esta barbería
        let { data: fidelizacion, error: errFidel } = await supabase
            .from('fidelizacion')
            .select('*')
            .eq('cliente_id', cliente.id)
            .eq('local_id', LOCAL_ID)
            .single();

        // C) Si es la primera vez que viene, le creamos la tarjeta a 0 sellos
        if (errFidel && errFidel.code === 'PGRST116') { 
            const { data: nuevaFidel, error: errInsert } = await supabase
                .from('fidelizacion')
                .insert([{ cliente_id: cliente.id, local_id: LOCAL_ID, sellos_actuales: 0 }])
                .select()
                .single();
            
            if (errInsert) throw errInsert;
            fidelizacion = nuevaFidel;
        } else if (errFidel) {
            throw errFidel;
        }

        fidelizacionActual = fidelizacion;
        actualizarUI();

        // Mostrar el panel de botones y ocultar el escáner
        searchSection.classList.add('hidden');
        controlPanel.classList.remove('hidden');
        controlPanel.classList.add('flex');

    } catch (error) {
        alert(error.message);
    }
}

// 3. Modificar Sellos (+1, -1)
async function modificarSellos(cantidad) {
    if (!fidelizacionActual) return;
    
    let nuevosSellos = fidelizacionActual.sellos_actuales + cantidad;
    if (nuevosSellos < 0) nuevosSellos = 0;
    if (nuevosSellos > 10) nuevosSellos = 10;

    try {
        const { data, error } = await supabase
            .from('fidelizacion')
            .update({ sellos_actuales: nuevosSellos })
            .eq('id', fidelizacionActual.id)
            .select()
            .single();

        if (error) throw error;
        fidelizacionActual = data;
        actualizarUI();
    } catch (error) {
        console.error(error);
        alert('Error al sincronizar con el servidor.');
    }
}

// 4. Actualizar textos en pantalla
function actualizarUI() {
    txtNombre.textContent = `${clienteActual.nombre} ${clienteActual.apellidos}`;
    txtSellos.textContent = `${fidelizacionActual.sellos_actuales} / 10 Sellos`;

    if (fidelizacionActual.sellos_actuales >= 10) {
        btnCanjear.classList.remove('hidden');
    } else {
        btnCanjear.classList.add('hidden');
    }
}

btnSumar.addEventListener('click', () => modificarSellos(1));
btnRestar.addEventListener('click', () => modificarSellos(-1));
btnCanjear.addEventListener('click', () => {
    if(confirm('¿Seguro que quieres canjear el corte y reiniciar la tarjeta de este cliente?')) {
        modificarSellos(-10);
    }
});

// Cerrar vista del cliente actual
btnCerrar.addEventListener('click', () => {
    clienteActual = null;
    fidelizacionActual = null;
    controlPanel.classList.add('hidden');
    controlPanel.classList.remove('flex');
    searchSection.classList.remove('hidden');
});