import { supabase } from './supabase-config.js';

const appContainer = document.getElementById('app-container');

// 1. Inicializador de la aplicación
function initApp() {
    const clientId = localStorage.getItem('reminder_client_id');
    
    if (clientId) {
        renderMainView(clientId);
    } else {
        renderRegisterForm();
    }
}

// 2. Renderizar el formulario de registro
function renderRegisterForm() {
    appContainer.innerHTML = `
        <div class="flex flex-col h-full justify-center px-4 max-w-sm mx-auto">
            <div class="mb-8">
                <div class="flex items-center gap-2 mb-6">
                    <div class="w-8 h-8 bg-reminder-neon text-black font-extrabold flex items-center justify-center rounded">R</div>
                    <span class="font-extrabold text-xl tracking-tight">reminder</span>
                </div>
                <h1 class="text-3xl font-extrabold uppercase leading-tight mb-2">Tu pase de <br><span class="text-reminder-neon">Fidelidad</span></h1>
                <p class="text-reminder-gray text-sm">Completa tus datos para generar tu QR único.</p>
            </div>

            <form id="register-form" class="flex flex-col gap-4">
                <div>
                    <input type="text" id="nombre" placeholder="Nombre" required 
                        class="w-full bg-reminder-card text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-reminder-neon placeholder-neutral-500 font-sans">
                </div>
                <div>
                    <input type="text" id="apellidos" placeholder="Apellidos" required 
                        class="w-full bg-reminder-card text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-reminder-neon placeholder-neutral-500 font-sans">
                </div>
                <div>
                    <input type="date" id="fecha_nac" required 
                        class="w-full bg-reminder-card text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-reminder-neon text-neutral-400 font-sans appearance-none">
                </div>
                <div>
                    <input type="tel" id="telefono" placeholder="Teléfono" required 
                        class="w-full bg-reminder-card text-white px-4 py-3 rounded-xl border border-neutral-800 focus:outline-none focus:border-reminder-neon placeholder-neutral-500 font-sans">
                </div>
                
                <div class="flex items-center gap-3 mt-2 mb-4">
                    <input type="checkbox" id="terminos" required 
                        class="w-5 h-5 accent-reminder-neon bg-reminder-card border-neutral-800 rounded">
                    <label for="terminos" class="text-xs text-reminder-gray">Acepto los términos y condiciones de privacidad.</label>
                </div>

                <button type="submit" id="btn-submit" 
                    class="w-full bg-reminder-neon text-black font-extrabold uppercase py-4 rounded-xl hover:bg-yellow-400 transition-colors">
                    Generar mi QR
                </button>
            </form>
        </div>
    `;

    // Asignar el evento al formulario recién creado
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
}

// 3. Lógica para procesar el registro y enviar a Supabase
async function handleRegistration(e) {
    e.preventDefault(); // Evitar que la página se recargue
    const btn = document.getElementById('btn-submit');
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    // Recoger valores
    const nombre = document.getElementById('nombre').value;
    const apellidos = document.getElementById('apellidos').value;
    const fecha_nac = document.getElementById('fecha_nac').value;
    const telefono = document.getElementById('telefono').value;
    const qr_hash = crypto.randomUUID(); // Genera un identificador único seguro para el QR

    try {
        // En este paso simplificado para la PWA, creamos un registro anónimo o insertamos directamente
        // NOTA: Para producción idealmente se usa auth.signUp, pero para máxima velocidad de demo
        // insertamos directamente en la tabla si las políticas RLS en Supabase lo permiten.
        
        const { data, error } = await supabase
            .from('clientes')
            .insert([
                { 
                    nombre: nombre, 
                    apellidos: apellidos, 
                    fecha_nacimiento: fecha_nac, 
                    telefono: telefono, 
                    qr_hash: qr_hash 
                }
            ])
            .select();

        if (error) throw error;

        // Guardar persistencia en el dispositivo
        const nuevoClienteId = data[0].id;
        localStorage.setItem('reminder_client_id', nuevoClienteId);
        
        // Pasar a la vista principal
        renderMainView(nuevoClienteId);

    } catch (error) {
        console.error('Error al registrar:', error);
        // Cambia la alerta para que muestre el mensaje técnico de Supabase:
        alert('Detalle del error: ' + (error.message || JSON.stringify(error)));
        btn.textContent = 'Generar mi QR';
        btn.disabled = false;
    }
}

// 4. Renderizar vista principal (Tarjeta, QR y Botón de instalación)
async function renderMainView(clientId) {
    appContainer.innerHTML = `
        <div class="flex items-center justify-center h-full">
            <p class="text-reminder-neon animate-pulse font-extrabold">Cargando tu pase...</p>
        </div>
    `;

    try {
        // 4.1 Obtener los datos del cliente
        const { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('nombre, apellidos, qr_hash')
            .eq('id', clientId)
            .single();

        if (errCliente) throw errCliente;

        // 4.2 Obtener la tarjeta de fidelización uniendo los datos de la tabla locales
        const { data: fidelizaciones, error: errFidel } = await supabase
            .from('fidelizacion')
            .select('sellos_actuales, locales(nombre, logo_url, max_sellos)')
            .eq('cliente_id', clientId);

        if (errFidel) throw errFidel;

        let nombreLocal = "Tu Barbería";
        let logoUrl = null;
        let maxSellos = 10;
        let sellosActuales = 0;
        let mensajeProgreso = "Escanea tu QR en tu próxima visita";

        if (fidelizaciones && fidelizaciones.length > 0) {
            const tarjeta = fidelizaciones[0]; 
            nombreLocal = tarjeta.locales.nombre;
            logoUrl = tarjeta.locales.logo_url;
            maxSellos = tarjeta.locales.max_sellos;
            sellosActuales = tarjeta.sellos_actuales;
            mensajeProgreso = "Vas por buen camino";
        }

        const logoHTML = logoUrl 
            ? `<img src="${logoUrl}" alt="Logo" class="w-12 h-12 rounded-full object-cover border border-neutral-700">`
            : `<div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-extrabold text-xl">${nombreLocal.substring(0, 2).toUpperCase()}</div>`;

        let sellosHTML = '';
        for (let i = 0; i < maxSellos; i++) {
            if (i < sellosActuales) {
                sellosHTML += `
                    <div class="bg-reminder-neon rounded-xl aspect-square flex items-center justify-center shadow-[0_0_10px_rgba(211,255,36,0.3)]">
                        <svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                `;
            } else {
                sellosHTML += `
                    <div class="bg-[#111111] rounded-xl aspect-square flex items-center justify-center border border-neutral-800/50">
                        <div class="w-1.5 h-1.5 rounded-full bg-neutral-700"></div>
                    </div>
                `;
            }
        }

        // 4.3 Renderizar la interfaz completa
        appContainer.innerHTML = `
            <!-- Topbar -->
            <header class="flex justify-between items-center py-4 mb-2">
                <button class="text-white"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg></button>
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-reminder-neon text-black font-extrabold flex items-center justify-center rounded text-xs">R</div>
                    <span class="font-extrabold text-lg tracking-tight">reminder</span>
                </div>
                <button class="w-10 h-10 bg-reminder-card rounded-full flex items-center justify-center border border-neutral-800">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                </button>
            </header>

            <div class="flex-1 overflow-y-auto pb-24 hide-scrollbar">
                <!-- Titular -->
                <div class="mb-6">
                    <p class="text-reminder-neon text-xs font-extrabold uppercase tracking-widest mb-1">Tu pase de fidelidad</p>
                    <h1 class="text-4xl font-extrabold uppercase leading-none mb-3">CADA VISITA<br>CUENTA.</h1>
                    <p class="text-reminder-gray text-sm">Tu barbería de siempre, con recompensas que merecen la pena.</p>
                </div>

                <!-- Tarjeta de Sellos Dinámica -->
                <div class="bg-reminder-card rounded-[2rem] p-6 mb-6 border border-neutral-800">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-center gap-3">
                            ${logoHTML}
                            <div>
                                <h2 class="font-extrabold text-lg leading-tight uppercase">${nombreLocal}</h2>
                                <p class="text-reminder-gray text-xs font-semibold tracking-wider uppercase">Barber Club</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-extrabold leading-none">${sellosActuales}<span class="text-sm text-reminder-gray">/${maxSellos}</span></p>
                            <p class="text-reminder-neon text-[0.65rem] font-extrabold tracking-widest uppercase mt-1">Sellos</p>
                        </div>
                    </div>
                    
                    <p class="text-sm text-neutral-400 mb-4">${mensajeProgreso}</p>
                    
                    <div class="grid grid-cols-5 gap-2 mb-6">
                        ${sellosHTML}
                    </div>

                    <div class="bg-[#111111] rounded-2xl p-4 flex items-center justify-between border border-neutral-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-reminder-neon rounded-xl flex items-center justify-center text-black">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 11-4 0 2 2 0 014 0zM19 12a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            </div>
                            <div>
                                <p class="font-bold text-sm">Tu ${maxSellos}ª visita es gratis</p>
                                <p class="text-reminder-gray text-xs">Un corte por cuenta de la casa.</p>
                            </div>
                        </div>
                        <span class="text-reminder-neon text-xs font-bold bg-reminder-neon/10 px-2 py-1 rounded">CASI AHÍ</span>
                    </div>
                </div>

                <!-- Tarjeta del QR -->
                <div class="bg-reminder-card rounded-[2rem] p-6 mb-8 flex flex-col items-center border border-neutral-800">
                    <p class="text-reminder-gray text-xs uppercase tracking-widest mb-2">Tu código de cliente</p>
                    <h2 class="text-2xl font-extrabold mb-6">${cliente.nombre} ${cliente.apellidos}</h2>
                    
                    <div class="bg-white p-3 rounded-2xl border-b-4 border-reminder-neon mb-6">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${cliente.qr_hash}&bgcolor=ffffff&color=000000" alt="QR Cliente" class="w-52 h-52 rounded-lg">
                    </div>
                    
                    <p class="text-reminder-gray text-sm text-center mb-8">Enséñale este QR a tu barbero para<br>sumar tu próximo sello.</p>

                    <div class="w-full mb-4">
                        <p class="text-center text-sm mb-4">Sin descargar ninguna app. <span class="text-reminder-neon font-bold">Así de fácil.</span></p>
                        <button class="w-full bg-[#111111] border border-neutral-800 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 mb-3 hover:bg-neutral-800 transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.31-.88 3.5-.8 1.48.1 2.5.64 3.23 1.6-2.73 1.57-2.3 5.48.51 6.55-.65 1.76-1.57 3.53-2.32 4.82zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                            Añadir a Apple Wallet
                        </button>
                        <button class="w-full bg-[#111111] border border-neutral-800 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-800 transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            Añadir a Google Wallet
                        </button>

                        <!-- BOTÓN DE INSTALACIÓN MANUAL PWA (Oculto por defecto hasta que el navegador permita instalar) -->
                        <button id="btn-instalar" class="w-full bg-reminder-neon text-black font-extrabold py-3.5 rounded-xl mt-3 hidden items-center justify-center gap-2 hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(211,255,36,0.3)]">
                            📱 Instalar aplicación Reminder
                        </button>
                    </div>
                </div>
            </div>

            <!-- Bottom Navigation -->
            <nav class="fixed bottom-0 w-full max-w-md bg-[#111111] border-t border-neutral-800/80 px-6 py-4 flex justify-around pb-6 z-50">
                <button class="flex flex-col items-center gap-1 text-reminder-neon">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                    <span class="text-[0.65rem] font-bold">Inicio</span>
                </button>
                <button class="flex flex-col items-center gap-1 text-neutral-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span class="text-[0.65rem] font-medium">Perfil</span>
                </button>
            </nav>
            
            <style>
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            </style>
        `;

        // 4.4 Activar la lógica del botón de instalación dentro de la vista renderizada
        setupInstallPrompt();

    } catch (error) {
        console.error('Error al cargar la vista:', error);
        appContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
                <p class="text-red-500 mb-4">No se pudo cargar la información. Revisa tu conexión.</p>
                <button onclick="location.reload();" class="px-6 py-3 bg-neutral-800 font-bold text-white rounded-xl">Reintentar</button>
            </div>
        `;
    }
}

// 5. Lógica para capturar y mostrar el botón de instalación de la PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setupInstallPrompt();
});

function setupInstallPrompt() {
    const btnInstalar = document.getElementById('btn-instalar');
    if (btnInstalar && deferredPrompt) {
        btnInstalar.classList.remove('hidden');
        btnInstalar.classList.add('flex');
        
        btnInstalar.onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('Usuario aceptó instalar la PWA');
                }
                deferredPrompt = null;
                btnInstalar.classList.add('hidden');
            }
        };
    }
}

// Arrancar la app
initApp();