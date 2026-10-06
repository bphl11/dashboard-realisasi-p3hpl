// ============================================================
// TU AUTH - Google Identity Services + whitelist Operator
// Namespace dan session storage TU dibuat terpisah dari RPD.
// ============================================================

const TU_AUTH_STORAGE_KEY = "p3hpl_tu_user_v1";
const TU_ID_TOKEN_STORAGE_KEY = "p3hpl_tu_id_token_v1";

function tuGetStoredUser() {
    try {
        const raw = sessionStorage.getItem(TU_AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function tuSetStoredUser(user) {
    const safeUser = {
        email: user?.email || "",
        name: user?.name || "",
        role: user?.role || ""
    };

    sessionStorage.setItem(
        TU_AUTH_STORAGE_KEY,
        JSON.stringify(safeUser)
    );
}

function tuGetIdToken() {
    try {
        return String(
            sessionStorage.getItem(TU_ID_TOKEN_STORAGE_KEY) || ""
        ).trim();
    } catch (e) {
        return "";
    }
}

function tuSetIdToken(idToken) {
    if (!idToken) {
        sessionStorage.removeItem(TU_ID_TOKEN_STORAGE_KEY);
        return;
    }

    sessionStorage.setItem(
        TU_ID_TOKEN_STORAGE_KEY,
        String(idToken)
    );
}

function tuClearSession() {
    sessionStorage.removeItem(TU_AUTH_STORAGE_KEY);
    sessionStorage.removeItem(TU_ID_TOKEN_STORAGE_KEY);
}

function tuShowMessage(message, type = "danger") {
    const el = document.getElementById("tuAuthMessage");

    if (!el) return;

    el.className = "alert alert-" + type;
    el.textContent = message;
    el.classList.remove("d-none");
}

function tuHideMessage() {
    const el = document.getElementById("tuAuthMessage");

    if (el) {
        el.classList.add("d-none");
    }
}

function tuSetLoginLoading(loading) {
    const el = document.getElementById("tuLoginLoading");

    if (el) {
        el.classList.toggle("d-none", !loading);
    }
}

function tuRenderUser(user) {
    const userName = document.getElementById("tuUserName");
    const userEmail = document.getElementById("tuUserEmail");

    if (userName) {
        userName.textContent = user?.name || "Operator";
    }

    if (userEmail) {
        userEmail.textContent = user?.email || "";
    }
}

function tuShowApp(user) {
    tuRenderUser(user);

    document.getElementById("tuLoginPanel")?.classList.add("d-none");
    document.getElementById("tuAppPanel")?.classList.remove("d-none");
    document.getElementById("tuUserBox")?.classList.remove("d-none");
}

function tuShowLogin() {
    document.getElementById("tuLoginPanel")?.classList.remove("d-none");
    document.getElementById("tuAppPanel")?.classList.add("d-none");
    document.getElementById("tuUserBox")?.classList.add("d-none");
}

async function tuHandleCredentialResponse(response) {
    tuHideMessage();

    if (!response?.credential) {
        tuShowMessage(
            "Google tidak mengembalikan token login."
        );
        return;
    }

    if (!TU_CONFIG.TU_API_URL) {
        tuShowMessage(
            "TU_API_URL belum diisi di assets/js/tu-config.js."
        );
        return;
    }

    tuSetLoginLoading(true);

    try {
        console.log(
            "TU: mengirim autentikasi Google ke Apps Script..."
        );

        // Token hanya disimpan di sessionStorage selama sesi browser.
        // Tidak dimasukkan ke objek user yang disimpan sebagai profil.
        tuSetIdToken(response.credential);

        const result = await tuApiRequest("tu_bootstrap", {
            tahun: TU_CONFIG.TAHUN_DEFAULT
        });

        if (!result?.ok || !result?.user) {
            tuClearSession();
            tuShowLogin();

            tuShowMessage(
                result?.message ||
                "Login TU gagal."
            );

            return;
        }

        if (
            String(result.user.role || "").trim().toUpperCase() !==
            "OPERATOR"
        ) {
            tuClearSession();
            tuShowLogin();

            tuShowMessage(
                "Akses TU hanya diperbolehkan untuk Operator."
            );

            return;
        }

        tuSetStoredUser(result.user);
        tuShowApp(result.user);

        // Bootstrap pertama sudah didapat saat autentikasi.
        // Data ini belum disimpan ke cache TU pada tahap foundation.
        if (typeof tuHandleBootstrap === "function") {
            await tuHandleBootstrap(result);
        }
    } catch (error) {
        console.error("TU login error:", error);

        tuClearSession();
        tuShowLogin();

        tuShowMessage(
            error.message || "Login TU gagal."
        );
    } finally {
        tuSetLoginLoading(false);
    }
}

function tuInitGoogleLogin() {
    if (!TU_CONFIG.GOOGLE_CLIENT_ID) {
        tuShowMessage(
            "GOOGLE_CLIENT_ID belum diisi di assets/js/tu-config.js.",
            "warning"
        );
        return;
    }

    const render = () => {
        if (!window.google?.accounts?.id) {
            tuShowMessage(
                "Google Identity Services belum termuat. Periksa koneksi internet.",
                "warning"
            );
            return;
        }

        google.accounts.id.initialize({
            client_id: TU_CONFIG.GOOGLE_CLIENT_ID,
            callback: tuHandleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const container =
            document.getElementById("googleSignInButton");

        if (container) {
            container.innerHTML = "";

            google.accounts.id.renderButton(
                container,
                {
                    theme: "outline",
                    size: "large",
                    text: "signin_with",
                    shape: "rectangular",
                    width: 300
                }
            );
        }
    };

    if (window.google?.accounts?.id) {
        render();
    } else {
        window.addEventListener(
            "load",
            render,
            { once: true }
        );
    }
}

function tuLogout() {
    tuClearSession();

    if (window.google?.accounts?.id) {
        try {
            google.accounts.id.disableAutoSelect();
        } catch (e) {}
    }

    tuShowLogin();

    tuShowMessage(
        "Anda telah keluar dari modul TU.",
        "success"
    );
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        const stored = tuGetStoredUser();

        if (stored?.email && tuGetIdToken()) {
            tuShowApp(stored);

            if (typeof tuInitData === "function") {
                tuInitData();
            }
        } else {
            tuClearSession();
            tuShowLogin();
            tuInitGoogleLogin();
        }

        document
            .getElementById("tuLogoutButton")
            ?.addEventListener("click", tuLogout);
    }
);
