import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, getDoc, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCOzTgyw5GqN9OeGvot45rqXAcjs5w848M",
  authDomain: "pc-recarga-77d05.firebaseapp.com",
  projectId: "pc-recarga-77d05",
  storageBucket: "pc-recarga-77d05.firebasestorage.app",
  messagingSenderId: "381158278092",
  appId: "1:381158278092:web:7c412045942c9b85e11369",
  measurementId: "G-X2DVSC98RB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let userData = null;

// Escuchar cambios de sesión y sincronizar con Firestore en tiempo real
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const headerAuth = document.getElementById('userHeaderAuth');
    const betHeaderAuth = document.getElementById('betUserHeaderAuth');
    
    if (user) {
        // Verificar si el usuario ya existe en Firestore, si no, crearlo (ej. Google Login)
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const nameParts = (user.displayName || "").split(" ");
            await setDoc(userRef, {
                nombre: nameParts[0] || "Usuario",
                apellido: nameParts.slice(1).join(" ") || "",
                correo: user.email,
                telefono: "No registrado",
                saldoDepositado: 0.00,
                saldoRetiro: 0.00,
                saldoBonos: 0.00,
                createdAt: Date.now()
            });
        }

        // Escuchar datos del usuario en tiempo real (Saldo)
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                userData = docSnap.data();
                updateAllBalances(userData);
            }
        });

        // Renderizar header si existe
        if (headerAuth) {
            headerAuth.innerHTML = `
                <div class="flex items-center gap-2 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-xl text-xs">
                    <img src="${user.photoURL || 'https://via.placeholder.com/30'}" class="w-6 h-6 rounded-full" alt="User">
                    <span class="text-gray-200 font-semibold hidden sm:inline">${userData?.nombre || user.email}</span>
                    <button onclick="window.logoutUser()" class="text-red-400 hover:text-red-300 ml-1" title="Cerrar sesión">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            `;
        }

        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.classList.add('hidden');

    } else {
        userData = null;
        if (headerAuth) {
            headerAuth.innerHTML = `
                <button onclick="document.getElementById('loginModal').classList.remove('hidden')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow">
                    Iniciar Sesión
                </button>
            `;
        }
    }
});

function updateAllBalances(data) {
    const totalSaldo = (data.saldoDepositado || 0) + (data.saldoRetiro || 0) + (data.saldoBonos || 0);
    
    // Actualizar elementos en WARDERTBET y otras páginas
    const balanceEls = document.querySelectorAll('#betUserBalance, .user-total-balance');
    balanceEls.forEach(el => {
        el.textContent = `$${totalSaldo.toFixed(2)} USD`;
    });

    // Actualizar datos del modal de desglose si está abierto
    const depEl = document.getElementById('modalSaldoDepositado');
    const retEl = document.getElementById('modalSaldoRetiro');
    const bonEl = document.getElementById('modalSaldoBonos');
    
    if (depEl) depEl.textContent = `$${(data.saldoDepositado || 0).toFixed(2)} USD`;
    if (retEl) retEl.textContent = `$${(data.saldoRetiro || 0).toFixed(2)} USD`;
    if (bonEl) bonEl.textContent = `$${(data.saldoBonos || 0).toFixed(2)} USD`;
}

// Registro con correo y contraseña (Saldo 0.00 inicial)
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('regNombre').value;
            const apellido = document.getElementById('regApellido').value;
            const correo = document.getElementById('regCorreo').value;
            const password = document.getElementById('regPassword').value;
            const telefono = document.getElementById('regTelefono').value;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
                const user = userCredential.user;

                await sendEmailVerification(user);

                // Guardar en Firestore con saldo en 0.00
                await setDoc(doc(db, "users", user.uid), {
                    nombre,
                    apellido,
                    correo,
                    telefono,
                    saldoDepositado: 0.00,
                    saldoRetiro: 0.00,
                    saldoBonos: 0.00,
                    createdAt: Date.now()
                });

                registerForm.classList.add('hidden');
                document.getElementById('registerSuccessMsg').classList.remove('hidden');
            } catch (error) {
                alert("Error al registrarse: " + error.message);
            }
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
            } catch (error) {
                alert("Error al iniciar sesión: Verifique sus credenciales.");
            }
        });
    }
});

window.loginWithGoogle = async function() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error Google Auth:", error);
    }
};

window.logoutUser = function() {
    signOut(auth).then(() => { window.location.reload(); });
};

export { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, auth, currentUser };