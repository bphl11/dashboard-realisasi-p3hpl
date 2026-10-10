// ============================================================
// TU AUTH
// Google Identity Services + whitelist Operator.
// Namespace/session TU dipisahkan dari RPD.
// Token hanya berada sementara di sessionStorage.
// ============================================================

const TU_AUTH_STORAGE_KEY =
    "p3hpl_tu_user_v1";

const TU_ID_TOKEN_STORAGE_KEY =
    "p3hpl_tu_id_token_v1";

function tuGetStoredUser() {
    try {
        const raw =
            sessionStorage.getItem(
                TU_AUTH_STORAGE_KEY
            );

        return raw
            ? JSON.parse(raw)
            : null;
    } catch (error) {
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
            sessionStorage.getItem(
                TU_ID_TOKEN_STORAGE_KEY
            ) || ""
        ).trim();
    } catch (error) {
        return "";
    }
}

function tuSetIdToken(idToken) {
    const value =
        String(idToken || "").trim();

    if (!value) {
        sessionStorage.removeItem(
            TU_ID_TOKEN_STORAGE_KEY
        );
        return;
    }

    sessionStorage.setItem(
        TU_ID_TOKEN_STORAGE_KEY,
        value
    );
}

function tuClearSession() {
    sessionStorage.removeItem(
        TU_AUTH_STORAGE_KEY
    );

    sessionStorage.removeItem(
        TU_ID_TOKEN_STORAGE_KEY
    );
}

function tuShowMessage(
    message,
    type = "danger"
) {
    const el =
        document.getElementById(
            "tuAuthMessage"
        );

    if (!el) return;

    el.className =
        "tu-alert tu-alert-" + type;

    el.textContent =
        message || "";

    el.classList.remove("d-none");
}

function tuHideMessage() {
    const el =
        document.getElementById(
            "tuAuthMessage"
        );

    if (el) {
        el.classList.add("d-none");
    }
}

function tuSetLoginLoading(loading) {
    const el =
        document.getElementById(
            "tuLoginLoading"
        );

    if (!el) return;

    el.classList.toggle(
        "d-none",
        !loading
    );
}

function tuRenderUser(user) {
    const name =
        document.getElementById(
            "tuUserName"
        );

    const email =
        document.getElementById(
            "tuUserEmail"
        );

    const role =
        document.getElementById(
            "tuUserRole"
        );

    if (name) {
        name.textContent =
            user?.name || "Operator";
    }

    if (email) {
        email.textContent =
            user?.email || "";
    }

    if (role) {
        role.textContent =
            String(
                user?.role || "OPERATOR"
            ).toUpperCase();
    }
}

function tuShowApp(user) {
    tuRenderUser(user);

    document.getElementById(
        "tuLoginPanel"
    )?.classList.add("d-none");

    document.getElementById(
        "tuAppPanel"
    )?.classList.remove("d-none");

    document.getElementById(
        "tuUserBox"
    )?.classList.remove("d-none");
}

function tuShowLogin() {
    document.getElementById(
        "tuLoginPanel"
    )?.classList.remove("d-none");

    document.getElementById(
        "tuAppPanel"
    )?.classList.add("d-none");

    document.getElementById(
        "tuUserBox"
    )?.classList.add("d-none");
}

async function tuHandleCredentialResponse(
    response
) {
    tuHideMessage();

    if (!response?.credential) {
        tuShowMessage(
            "Google tidak mengembalikan credential login."
        );
        return;
    }

    if (!String(
        TU_CONFIG?.TU_API_URL || ""
    ).trim()) {
        tuShowMessage(
            "TU_API_URL belum diisi di assets/js/tu-config.js."
        );
        return;
    }

    tuSetLoginLoading(true);

    try {
        tuSetIdToken(
            response.credential
        );

        const result =
            await tuApiRequest(
                "tu_bootstrap",
                {
                    tahun:
                        TU_CONFIG.TAHUN_DEFAULT
                }
            );

        if (
            !result?.ok ||
            !result?.user
        ) {
            tuClearSession();
            tuShowLogin();

            tuShowMessage(
                result?.message ||
                "Login TU gagal."
            );

            return;
        }

        if (
            String(
                result.user.role || ""
            )
            .trim()
            .toUpperCase() !==
            "OPERATOR"
        ) {
            tuClearSession();
            tuShowLogin();

            tuShowMessage(
                "Akses TU hanya diperbolehkan untuk Operator."
            );

            return;
        }

        tuSetStoredUser(
            result.user
        );

        tuShowApp(
            result.user
        );

        if (
            typeof tuHandleBootstrap ===
            "function"
        ) {
            await tuHandleBootstrap(
                result
            );
        }
    } catch (error) {
        console.error(
            "TU login error:",
            error
        );

        tuClearSession();
        tuShowLogin();

        tuShowMessage(
            error?.message ||
            "Login TU gagal."
        );
    } finally {
        tuSetLoginLoading(false);
    }
}

function tuInitGoogleLogin() {
    const clientId =
        String(
            TU_CONFIG?.GOOGLE_CLIENT_ID || ""
        ).trim();

    if (!clientId) {
        tuShowMessage(
            "GOOGLE_CLIENT_ID belum diisi di assets/js/tu-config.js.",
            "warning"
        );
        return;
    }

    const render = () => {
        if (!window.google?.accounts?.id) {
            tuShowMessage(
                "Google Identity Services belum termuat. Refresh halaman lalu coba lagi.",
                "warning"
            );
            return;
        }

        google.accounts.id.initialize({
            client_id: clientId,
            callback:
                tuHandleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const container =
            document.getElementById(
                "googleSignInButton"
            );

        if (!container) return;

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
        } catch (error) {
            console.warn(error);
        }
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
        const stored =
            tuGetStoredUser();

        if (
            stored?.email &&
            tuGetIdToken()
        ) {
            tuShowApp(stored);

            if (
                typeof tuInitData ===
                "function"
            ) {
                tuInitData();
            }
        } else {
            tuClearSession();
            tuShowLogin();
            tuInitGoogleLogin();
        }

        document
            .getElementById("tuLogoutButton")
            ?.addEventListener(
                "click",
                tuLogout
            );
    }
);
