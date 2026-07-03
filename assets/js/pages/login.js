import { redirectAuthenticatedUser, signIn } from "../auth.js";
import { enhanceFormAccessibility } from "../ui.js";
import { friendlyError, qs, render, withFormBusy } from "../utils.js";

const root = document.getElementById("login-page");

if (!document.querySelector('link[data-tjs-icons="material-symbols"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap";
  link.dataset.tjsIcons = "material-symbols";
  document.head.appendChild(link);
}

if (!await redirectAuthenticatedUser()) {
  render(root, `
    <main class="auth-shell">
      <header class="auth-topbar">
        <div style="font-family:'Noto Serif',serif; letter-spacing:0.18em; font-size:1.55rem;">Grand Millado Hotel</div>
        <div style="display:flex; gap:18px;">
          <span class="material-symbols-outlined">help</span>
          <span class="material-symbols-outlined">language</span>
        </div>
      </header>
      <div class="auth-shell-content">
        <section class="auth-card">
          <div class="auth-header">
            <div class="brand-mark">GMH</div>
            <p class="eyebrow">Secure Access</p>
            <h1>Grand Millado Hotel</h1>
            <p class="auth-subtitle">Sign in to manage reservations, guests, revenue, operations, and premium membership services.</p>
          </div>
          <form id="login-form" class="form-stack">
            <div class="field">
              <label for="email">Email Address</label>
              <input id="email" name="email" type="email" placeholder="name@grandmilladohotel.com" required>
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" placeholder="Enter your password" required>
            </div>
            <button class="btn btn-primary" id="login-submit" type="submit">Sign In</button>
            <p id="login-error" class="validation-error hidden"></p>
          </form>
          <div style="margin-top:22px;" class="muted">
            Access is limited to authorized Grand Millado Hotel personnel with active Supabase accounts.
          </div>
        </section>
      </div>
      <footer class="auth-footer">
        <div>Privacy Policy</div>
        <div>Authorized Personnel Only</div>
        <div>Grand Millado Hotel Operations</div>
      </footer>
    </main>
  `);

  enhanceFormAccessibility(root);

  qs("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorText = qs("#login-error");
    errorText.classList.add("hidden");

    try {
      await withFormBusy(event.currentTarget, "Signing In...", async () => {
        const email = qs("#email").value.trim();
        const password = qs("#password").value;
        await signIn(email, password);
        const next = new URLSearchParams(window.location.search).get("next") || "dashboard.html";
        window.location.replace(next);
      });
    } catch (error) {
      errorText.textContent = friendlyError(error, "Unable to sign in.");
      errorText.classList.remove("hidden");
    }
  });
}
