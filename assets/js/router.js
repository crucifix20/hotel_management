import { canAccessPage, getVisibleNav, requireAuth, signOut } from "./auth.js";
import { PAGE_META } from "./config.js";
import { createEmptyState, createPageLoadingState, renderAppShell, showToast } from "./ui.js";

export async function initProtectedPage(pageKey, initPage) {
  const root = document.getElementById("app");
  try {
    const auth = await requireAuth();
    if (!auth) {
      return;
    }

    if (!canAccessPage(auth.profile.role, pageKey)) {
      showToast("You do not have access to this module.", "error");
      window.location.replace("dashboard.html");
      return;
    }

    renderAppShell({
      root,
      profile: auth.profile,
      currentPage: pageKey,
      navItems: getVisibleNav(auth.profile.role),
    });

    const logoutButton = document.getElementById("logout-button");
    logoutButton?.addEventListener("click", async () => {
      try {
        await signOut();
        window.location.replace("index.html");
      } catch (error) {
        showToast(error.message || "Unable to sign out.", "error");
      }
    });

    document.title = `Grand Millado Hotel | ${PAGE_META[pageKey]?.title || "Operations"}`;
    const pageRoot = document.getElementById("page-content");
    pageRoot.innerHTML = createPageLoadingState(PAGE_META[pageKey]?.title || "Loading");

    await initPage({
      root: pageRoot,
      auth,
    });
  } catch (error) {
    console.error(`Unable to initialize page "${pageKey}".`, error);
    showToast(error.message || "Unable to load this page right now.", "error");

    if (root) {
      root.innerHTML = `
        <main class="page-body">
          <section class="table-card">
            ${createEmptyState({
              title: "Page failed to load",
              copy: error.message || "There was a problem loading this module. Refresh the page and verify your Supabase schema and current user profile.",
            })}
          </section>
        </main>
      `;
    }
  }
}
