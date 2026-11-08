import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "./script.js";
import { getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function formatMatchTime(minute, second = 0) {
    let min = parseInt(minute) || 0;
    let sec = parseInt(second) || 0;
    let mm = String(min).padStart(2, '0');
    let ss = String(sec).padStart(2, '0');
    return `${mm}:${ss}`;
}

window.adminLiveTimers = {};
let adminMediaStream = null;

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('adminMatchesTableBody');
    const countEl = document.getElementById('totalAdminMatchesCount');
    const bancostbody = document.getElementById('adminBancosTableBody');
    const bancoForm = document.getElementById('addBancoForm');
    const retirosTbody = document.getElementById('adminRetirosTableBody');

    onSnapshot(collection(db, "matches"), (snapshot) => {
        tbody.innerHTML = '';
        if (countEl) countEl.textContent = snapshot.size;

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">No hay partidos activos en Firestore.</td></tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const mId = docSnap.id;
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#1f2430]/50 transition-colors';

            let statusBadge = '';
            let actionBtns = '';

            if (data.status === 'created') {
                statusBadge = `<span class="text-yellow-400 font-bold text-[11px]">Fecha: ${data.scheduleDate || '05/11'} (${data.scheduleTime || '19:00'})</span>`;
                actionBtns = `<button data-id="${mId}" class="btn-start px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-[10px] shadow">Iniciar</button>`;
            } else if (data.status === 'live') {
                const matchKey = mId;
                
                let baseMinute = data.minute || 0;
                let baseSecond = data.second || 0;
                
                if (data.lastUpdatedTimestamp) {
                    const elapsedSeconds = Math.floor((Date.now() - data.lastUpdatedTimestamp) / 1000);
                    const totalSecs = (baseMinute * 60) + baseSecond + elapsedSeconds;
                    baseMinute = Math.floor(totalSecs / 60);
                    baseSecond = totalSecs % 60;
                }

                if (window.adminLiveTimers[matchKey] === undefined) {
                    window.adminLiveTimers[matchKey] = { minute: baseMinute, second: baseSecond };
                } else {
                    window.adminLiveTimers[matchKey].minute = baseMinute;
                    window.adminLiveTimers[matchKey].second = baseSecond;
                }

                const currentObj = window.adminLiveTimers[matchKey];
                const timeFormatted = formatMatchTime(currentObj.minute, currentObj.second);

                statusBadge = `<span class="text-red-400 font-bold text-[11px] animate-pulse admin-timer-badge" data-match="${matchKey}">EN VIVO <span class="timer-text">${timeFormatted}</span></span>`;
                actionBtns = `
                    <button data-id="${mId}" class="btn-halftime px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px]">Medio Tiempo</button>
                    <button data-id="${mId}" data-home="${data.home}" data-away="${data.away}" class="btn-finish px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px]">Finalizar y Liquidar</button>
                `;
            } else if (data.status === 'halftime') {
                statusBadge = `<span class="text-amber-400 font-bold text-[11px]">MEDIO TIEMPO</span>`;
                actionBtns = `<button data-id="${mId}" class="btn-resume px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-[10px]">Reanudar</button>`;
            } else if (data.status === 'finished') {
                statusBadge = `<span class="text-purple-400 font-bold text-[10px]">FINALIZADO</span>`;
                actionBtns = `<button data-id="${mId}" class="btn-delete px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px]">Borrar</button>`;
            }

            tr.innerHTML = `
                <td class="p-3">
                    <span class="font-bold text-white block">${data.home} vs ${data.away}</span>
                    <span class="text-[10px] text-gray-400">${data.league} (${data.scoreHome} - ${data.scoreAway})</span>
                </td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-center space-x-1">
                    ${actionBtns}
                    <button data-id="${mId}" 
                            data-home="${data.home}" 
                            data-away="${data.away}" 
                            data-scoreh="${data.scoreHome}" 
                            data-scorea="${data.scoreAway}" 
                            data-minute="${window.adminLiveTimers[mId] ? window.adminLiveTimers[mId].minute : (data.minute || 0)}" 
                            data-second="${window.adminLiveTimers[mId] ? window.adminLiveTimers[mId].second : (data.second || 0)}" 
                            data-oddh="${data.oddHome}" 
                            data-oddd="${data.oddDraw}" 
                            data-odda="${data.oddAway}" 
                            class="btn-edit px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500 text-yellow-400 font-bold text-[10px]">Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        attachTableListeners();
    });

    if (bancostbody) {
        onSnapshot(collection(db, "bancos"), (snapshot) => {
            bancostbody.innerHTML = '';
            if (snapshot.empty) {
                bancostbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay bancos configurados en el sistema.</td></tr>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const bId = docSnap.id;
                const data = docSnap.data();
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-[#1f2430]/50 transition-colors';
                tr.innerHTML = `
                    <td class="p-3 font-bold text-white">${data.nombreBanco}</td>
                    <td class="p-3">${data.tipoCuenta}</td>
                    <td class="p-3 font-mono text-yellow-400">${data.numeroCuenta}</td>
                    <td class="p-3">${data.titular}</td>
                    <td class="p-3 text-center space-x-1">
                        <button data-id="${bId}" class="btn-delete-banco px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[10px]">Eliminar</button>
                    </td>
                `;
                bancostbody.appendChild(tr);
            });

            attachBancoListeners();
        });
    }

    if (retirosTbody) {
        onSnapshot(collection(db, "retiros"), (snapshot) => {
            retirosTbody.innerHTML = '';
            if (snapshot.empty) {
                retirosTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No hay solicitudes de retiro pendientes.</td></tr>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const rId = docSnap.id;
                const r = docSnap.data();
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-[#1f2430]/50 transition-colors';

                let estadoText = `<span class="text-amber-400 font-bold">PENDIENTE</span>`;
                if (r.estado === 'aceptado') estadoText = `<span class="text-emerald-400 font-bold">ACEPTADO</span>`;
                if (r.estado === 'rechazado') estadoText = `<span class="text-red-400 font-bold">RECHAZADO</span>`;

                tr.innerHTML = `
                    <td class="p-3">
                        <span class="font-bold text-white block">${r.email || 'Usuario'}</span>
                        <span class="text-[10px] text-gray-400">Cuenta: ${r.numeroCuenta}</span>
                    </td>
                    <td class="p-3">
                        <span class="font-black text-emerald-400 block">$${parseFloat(r.monto).toFixed(2)} USD</span>
                        <span class="text-[10px] text-gray-300">${r.bancoRetiro}</span>
                    </td>
                    <td class="p-3">${estadoText}</td>
                    <td class="p-3 text-center space-x-1">
                        <button onclick="gestionarRetiro('${rId}', 'aceptado', '${r.uid}', ${r.monto})" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold text-[10px]">Aceptar</button>
                        <button onclick="gestionarRetiro('${rId}', 'rechazado', '${r.uid}', ${r.monto})" class="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px]">Rechazar</button>
                    </td>
                `;
                retirosTbody.appendChild(tr);
            });
        });
    }

    const addForm = document.getElementById('addMatchForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await addDoc(collection(db, "matches"), {
                    league: document.getElementById('matchLeague').value,
                    home: document.getElementById('matchHome').value,
                    away: document.getElementById('matchAway').value,
                    oddHome: parseFloat(document.getElementById('oddHome').value),
                    oddDraw: parseFloat(document.getElementById('oddDraw').value),
                    oddAway: parseFloat(document.getElementById('oddAway').value),
                    scheduleDate: document.getElementById('matchDate').value,
                    scheduleTime: document.getElementById('matchTime').value,
                    status: "created",
                    minute: 0,
                    second: 0,
                    scoreHome: 0,
                    scoreAway: 0,
                    lastUpdatedTimestamp: Date.now(),
                    createdAt: Date.now()
                });
                alert('¡Partido publicado con éxito en Firebase!');
                addForm.reset();
            } catch (error) {
                console.error("Error al publicar:", error);
            }
        });
    }

    if (bancoForm) {
        bancoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await addDoc(collection(db, "bancos"), {
                    nombreBanco: document.getElementById('adminNombreBanco').value,
                    tipoCuenta: document.getElementById('adminTipoCuenta').value,
                    numeroCuenta: document.getElementById('adminNumCuenta').value,
                    titular: document.getElementById('adminTitular').value,
                    createdAt: Date.now()
                });
                alert('¡Cuenta bancaria agregada con éxito!');
                bancoForm.reset();
            } catch (error) {
                console.error("Error al agregar banco:", error);
                alert("Error al agregar el banco.");
            }
        });
    }

    const closeBtn = document.getElementById('closeEditModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('editModal').classList.add('hidden');
        });
    }

    const editForm = document.getElementById('editMatchForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('editMatchId').value;
            const nuevoMinuto = parseInt(document.getElementById('editMatchMinute').value) || 0;
            const nuevoSegundo = parseInt(document.getElementById('editMatchSecond').value) || 0;

            await updateDoc(doc(db, "matches", id), {
                scoreHome: parseInt(document.getElementById('editScoreHome').value) || 0,
                scoreAway: parseInt(document.getElementById('editScoreAway').value) || 0,
                minute: nuevoMinuto,
                second: nuevoSegundo,
                lastUpdatedTimestamp: Date.now(),
                oddHome: parseFloat(document.getElementById('editOddH').value),
                oddDraw: parseFloat(document.getElementById('editOddD').value),
                oddAway: parseFloat(document.getElementById('editOddA').value)
            });

            if (window.adminLiveTimers[id]) {
                window.adminLiveTimers[id].minute = nuevoMinuto;
                window.adminLiveTimers[id].second = nuevoSegundo;
            }

            document.getElementById('editModal').classList.add('hidden');
            alert('¡Partido y tiempo actualizados correctamente!');
        });
    }
});

// FUNCIONES DE CONTROL DE TRANSMISIÓN DE PANTALLA EN VIVO
window.iniciarTransmisionAdmin = async function() {
    try {
        adminMediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
        });

        const localVideo = document.getElementById('adminLocalVideo');
        const placeholder = document.getElementById('adminVideoPlaceholder');
        const statusBadge = document.getElementById('adminStreamStatus');
        const btnIniciar = document.getElementById('btnIniciarTransmision');
        const btnDetener = document.getElementById('btnDetenerTransmision');

        localVideo.srcObject = adminMediaStream;
        localVideo.classList.remove('hidden');
        placeholder.classList.add('hidden');

        statusBadge.textContent = "EN VIVO";
        statusBadge.className = "px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold animate-pulse";
        
        btnIniciar.classList.add('hidden');
        btnDetener.classList.remove('hidden');

        await updateDoc(doc(db, "configuracion", "streaming"), {
            activo: true,
            updatedAt: Date.now()
        });

        adminMediaStream.getVideoTracks()[0].onended = () => {
            window.detenerTransmisionAdmin();
        };

    } catch (error) {
        console.error("Error al iniciar la transmisión de pantalla:", error);
        alert("No se pudo iniciar la transmisión: " + error.message);
    }
};

window.detenerTransmisionAdmin = async function() {
    if (adminMediaStream) {
        adminMediaStream.getTracks().forEach(track => track.stop());
        adminMediaStream = null;
    }

    const localVideo = document.getElementById('adminLocalVideo');
    const placeholder = document.getElementById('adminVideoPlaceholder');
    const statusBadge = document.getElementById('adminStreamStatus');
    const btnIniciar = document.getElementById('btnIniciarTransmision');
    const btnDetener = document.getElementById('btnDetenerTransmision');

    if (localVideo) {
        localVideo.srcObject = null;
        localVideo.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (statusBadge) {
        statusBadge.textContent = "APAGADO";
        statusBadge.className = "px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-extrabold";
    }

    if (btnIniciar) btnIniciar.classList.remove('hidden');
    if (btnDetener) btnDetener.classList.add('hidden');

    try {
        await updateDoc(doc(db, "configuracion", "streaming"), {
            activo: false,
            updatedAt: Date.now()
        });
    } catch (e) {
        console.error(e);
    }
};

setInterval(() => {
    for (let matchKey in window.adminLiveTimers) {
        let t = window.adminLiveTimers[matchKey];
        t.second++;
        if (t.second >= 60) {
            t.second = 0;
            t.minute++;
            if (t.minute > 90) {
                t.minute = 90;
            }
        }
        document.querySelectorAll(`.admin-timer-badge[data-match="${matchKey}"] .timer-text`).forEach(el => {
            el.textContent = formatMatchTime(t.minute, t.second);
        });
    }
}, 1000);

window.gestionarRetiro = async function(retornoId, nuevoEstado, userId, montoRetiro) {
    let motivo = prompt(nuevoEstado === 'aceptado' ? "Ingrese mensaje de confirmación (Ej: Transferencia realizada con éxito):" : "Ingrese el motivo del rechazo:");
    if (motivo === null) return;

    try {
        await updateDoc(doc(db, "retiros", retornoId), {
            estado: nuevoEstado,
            motivo: motivo || (nuevoEstado === 'aceptado' ? 'Retiro aprobado y transferido.' : 'Rechazado por el administrador.')
        });

        if (nuevoEstado === 'rechazado') {
            const userDocRef = doc(db, "users", userId);
            const userSnap = await getDocs(collection(db, "users"));
            userSnap.forEach(async (uDoc) => {
                if (uDoc.id === userId) {
                    const uData = uDoc.data();
                    const saldoActual = uData.saldoRetiro || 0;
                    await updateDoc(userDocRef, {
                        saldoRetiro: saldoActual + parseFloat(montoRetiro)
                    });
                }
            });
            alert("Retiro rechazado. El saldo ha sido devuelto a la cuenta del usuario.");
        } else {
            alert("Retiro aceptado con éxito.");
        }
    } catch (error) {
        console.error("Error al gestionar retiro:", error);
        alert("Error al actualizar el estado del retiro.");
    }
};

function attachTableListeners() {
    document.querySelectorAll('.btn-start').forEach(btn => {
        btn.onclick = async () => await updateDoc(doc(db, "matches", btn.dataset.id), { 
            status: 'live', 
            minute: 0, 
            second: 0, 
            lastUpdatedTimestamp: Date.now() 
        });
    });
    document.querySelectorAll('.btn-halftime').forEach(btn => {
        btn.onclick = async () => await updateDoc(doc(db, "matches", btn.dataset.id), { status: 'halftime' });
    });
    document.querySelectorAll('.btn-resume').forEach(btn => {
        btn.onclick = async () => await updateDoc(doc(db, "matches", btn.dataset.id), { 
            status: 'live', 
            minute: 46, 
            second: 0, 
            lastUpdatedTimestamp: Date.now() 
        });
    });

    document.querySelectorAll('.btn-finish').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm("¿Finalizar este partido y liquidar todas las apuestas asociadas?")) return;
            const matchId = btn.dataset.id;
            
            const matchRef = doc(db, "matches", matchId);
            await updateDoc(matchRef, { status: 'finished', finishedAt: Date.now() });

            const matchSnap = await getDocs(collection(db, "matches"));
            let matchData = null;
            matchSnap.forEach(d => {
                if (d.id === matchId) matchData = d.data();
            });

            if (matchData) {
                const sH = matchData.scoreHome;
                const sA = matchData.scoreAway;
                const matchFullName = `${matchData.home} vs ${matchData.away}`;

                let ganadorReal = "Empate";
                if (sH > sA) ganadorReal = matchData.home;
                else if (sA > sH) ganadorReal = matchData.away;

                const apuestasSnap = await getDocs(collection(db, "apuestas"));
                apuestasSnap.forEach(async (apuestaDoc) => {
                    const ap = apuestaDoc.data();
                    if (ap.partido === matchFullName && ap.estado === "PENDIENTE") {
                        let nuevoEstado = "PERDIDA";
                        let ganancia = 0;

                        if (ap.seleccion.toUpperCase() === ganadorReal.toUpperCase() || (ap.seleccion.toUpperCase() === "EMPATE" && ganadorReal === "Empate")) {
                            nuevoEstado = "GANADA";
                            ganancia = ap.retornoPotencial;

                            const userSnap = await getDocs(collection(db, "users"));
                            userSnap.forEach(async (uDoc) => {
                                if (uDoc.id === ap.uid) {
                                    const uData = uDoc.data();
                                    const saldoActualRetiro = uData.saldoRetiro || 0;
                                    await updateDoc(doc(db, "users", ap.uid), {
                                        saldoRetiro: saldoActualRetiro + ganancia
                                    });
                                }
                            });
                        }

                        await updateDoc(doc(db, "apuestas", apuestaDoc.id), {
                            estado: nuevoEstado
                        });
                    }
                });
            }

            alert("¡Partido finalizado y apuestas liquidadas con éxito!");
        };
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm("¿Borrar definitivamente este partido?")) {
                await deleteDoc(doc(db, "matches", btn.dataset.id));
            }
        };
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('editMatchId').value = btn.dataset.id;
            document.getElementById('editScoreHome').value = btn.dataset.scoreh;
            document.getElementById('editScoreAway').value = btn.dataset.scorea;
            document.getElementById('editMatchMinute').value = btn.dataset.minute;
            document.getElementById('editMatchSecond').value = btn.dataset.second;
            document.getElementById('editOddH').value = btn.dataset.oddh;
            document.getElementById('editOddD').value = btn.dataset.oddd;
            document.getElementById('editOddA').value = btn.dataset.odda;
            document.getElementById('editModal').classList.remove('hidden');
        };
    });
}

function attachBancoListeners() {
    document.querySelectorAll('.btn-delete-banco').forEach(btn => {
        btn.onclick = async () => {
            if (confirm("¿Eliminar este banco de la lista de recargas?")) {
                await deleteDoc(doc(db, "bancos", btn.dataset.id));
            }
        };
    });
}
window.guardarEIniciarTransmisionAdmin = async function() {
    const urlInput = document.getElementById('adminStreamUrlInput').value.trim();
    if (!urlInput) {
        alert("Por favor ingresa una URL de video válida.");
        return;
    }

    try {
        await setDoc(doc(db, "configuracion", "streaming"), {
            activo: true,
            urlStream: urlInput,
            titulo: "Transmisión Oficial WARDERTBET",
            updatedAt: Date.now()
        }, { merge: true });

        alert("¡Transmisión activada con éxito para todos los usuarios!");
    } catch (error) {
        console.error("Error al activar streaming:", error);
        alert("Error al guardar: " + error.message);
    }
};