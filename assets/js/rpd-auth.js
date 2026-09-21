// ============================================================
// RPD AUTH - Google Identity Services + whitelist email
// Hanya halaman RPD yang menggunakan modul ini.
// Dashboard/Monitoring/Grafik/Laporan/Audit tidak berubah.
// ============================================================

const RPD_AUTH_STORAGE_KEY = "p3hpl_rpd_user_v1";

function rpdGetStoredUser() {
    try {
        const raw = sessionStorage.getItem(RPD_AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function rpdSetStoredUser(user) {
    sessionStorage.setItem(RPD_AUTH_STORAGE_KEY, JSON.stringify(user));
}

function rpdClearStoredUser() {
    sessionStorage.removeItem(RPD_AUTH_STORAGE_KEY);
}

function rpdShowMessage(message, type = "danger") {
    const el = document.getElementById("rpdAuthMessage");
    if (!el) return;
    el.className = "alert alert-" + type;
    el.textContent = message;
    el.classList.remove("d-none");
}

function rpdHideMessage() {
    const el = document.getElementById("rpdAuthMessage");
    if (el) el.classList.add("d-none");
}

function rpdSetLoginLoading(loading) {
    const el = document.getElementById("rpdLoginLoading");
    if (el) el.classList.toggle("d-none", !loading);
}

function rpdRenderUser(user) {
    const userName = document.getElementById("rpdUserName");
    const userEmail = document.getElementById("rpdUserEmail");
    if (userName) userName.textContent = user?.name || "Operator";
    if (userEmail) userEmail.textContent = user?.email || "";
}

function rpdShowApp(user) {
    rpdRenderUser(user);
    document.getElementById("rpdLoginPanel")?.classList.add("d-none");
    document.getElementById("rpdAppPanel")?.classList.remove("d-none");
}

function rpdShowLogin() {
    document.getElementById("rpdLoginPanel")?.classList.remove("d-none");
    document.getElementById("rpdAppPanel")?.classList.add("d-none");
}

async function rpdHandleCredentialResponse(response) {
    rpdHideMessage();

    if (!response?.credential) {
        rpdShowMessage("Google tidak mengembalikan token login.");
        return;
    }

    if (!RPD_CONFIG.RPD_API_URL) {
        rpdShowMessage("RPD_API_URL belum diisi di assets/js/rpd-config.js.");
        return;
    }

    rpdSetLoginLoading(true);

    try {
        const result = await rpdApiRequest("auth", {
            id_token: response.credential
        });

        if (!result.ok || !result.user) {
            rpdShowMessage(result.message || "Email Anda belum terdaftar sebagai Operator RPD.");
            return;
        }

        rpdSetStoredUser(result.user);
        rpdShowApp(result.user);
        await rpdInitData();
    } catch (error) {
        console.error("RPD login error:", error);
        rpdShowMessage(error.message || "Login RPD gagal.");
    } finally {
        rpdSetLoginLoading(false);
    }
}

function rpdInitGoogleLogin() {
    if (!RPD_CONFIG.GOOGLE_CLIENT_ID) {
        rpdShowMessage("GOOGLE_CLIENT_ID belum diisi. Setelah OAuth Client ID dibuat, isi nilainya di assets/js/rpd-config.js.", "warning");
        return;
    }

    const render = () => {
        if (!window.google?.accounts?.id) {
            rpdShowMessage("Google Identity Services belum termuat. Periksa koneksi internet.", "warning");
            return;
        }

        google.accounts.id.initialize({
            client_id: RPD_CONFIG.GOOGLE_CLIENT_ID,
            callback: rpdHandleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const container = document.getElementById("googleSignInButton");
        if (container) {
            container.innerHTML = "";
            google.accounts.id.renderButton(container, {
                theme: "outline",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
                width: 300
            });
        }
    };

    if (window.google?.accounts?.id) render();
    else window.addEventListener("load", render, { once: true });
}

function rpdLogout() {
    rpdClearStoredUser();
    if (window.google?.accounts?.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
    rpdShowLogin();
    rpdShowMessage("Anda telah keluar dari modul RPD.", "success");
}

document.addEventListener("DOMContentLoaded", function () {
    const stored = rpdGetStoredUser();
    if (stored?.email) {
        rpdShowApp(stored);
        rpdInitData();
    } else {
        rpdShowLogin();
        rpdInitGoogleLogin();
    }

    document.getElementById("rpdLogoutButton")?.addEventListener("click", rpdLogout);
});
