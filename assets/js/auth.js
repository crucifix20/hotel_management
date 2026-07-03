import { NAV_ITEMS, PAGE_ACCESS, ROLES } from "./config.js";
import { createTransientSupabaseClient, supabase } from "./supabaseClient.js";

let profileCache = null;

function normalizeRole(role) {
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.STAFF;
}

function buildFallbackProfile(user, profile = {}) {
  const metadata = user?.user_metadata || {};
  return {
    id: user?.id || profile.id || null,
    full_name: profile.full_name || metadata.full_name || user?.email?.split("@")[0] || "Grand Millado Hotel User",
    role: normalizeRole(profile.role || metadata.role),
    avatar_url: profile.avatar_url || metadata.avatar_url || null,
    created_at: profile.created_at || null,
  };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  profileCache = null;
  return data;
}

export async function signOut() {
  profileCache = null;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

async function ensureProfile(user) {
  const metadata = user.user_metadata || {};
  const payload = {
    id: user.id,
    full_name: metadata.full_name || user.email?.split("@")[0] || "Grand Millado Hotel User",
    role: normalizeRole(metadata.role),
    avatar_url: metadata.avatar_url || null,
  };

  const { data, error } = await supabase
    .from("users_profile")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getCurrentProfile(force = false) {
  if (profileCache && !force) {
    return profileCache;
  }

  const session = await getSession();
  if (!session?.user) {
    return null;
  }

  const fallbackProfile = buildFallbackProfile(session.user);

  try {
    const { data, error } = await supabase
      .from("users_profile")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const profile = data || await ensureProfile(session.user);
    const normalizedProfile = buildFallbackProfile(session.user, profile);

    if (profile.role !== normalizedProfile.role) {
      const { error: updateError } = await supabase
        .from("users_profile")
        .update({ role: normalizedProfile.role })
        .eq("id", session.user.id);

      if (updateError) {
        console.warn("Unable to normalize users_profile role. Falling back to session metadata.", updateError);
      }
    }

    profileCache = normalizedProfile;
  } catch (error) {
    console.warn("Unable to load users_profile. Falling back to session metadata.", error);
    profileCache = fallbackProfile;
  }

  return profileCache;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    const next = encodeURIComponent(window.location.pathname.split("/").pop());
    window.location.replace(`index.html?next=${next}`);
    return null;
  }

  const profile = await getCurrentProfile();
  return { session, user: session.user, profile };
}

export async function redirectAuthenticatedUser() {
  const session = await getSession();
  if (session?.user) {
    window.location.replace("dashboard.html");
    return true;
  }
  return false;
}

export function getVisibleNav(role) {
  const normalizedRole = normalizeRole(role);
  return NAV_ITEMS.filter((item) => item.roles.includes(normalizedRole));
}

export function canAccessPage(role, pageKey) {
  const normalizedRole = normalizeRole(role);
  const allowedRoles = PAGE_ACCESS[pageKey];
  return Array.isArray(allowedRoles) ? allowedRoles.includes(normalizedRole) : false;
}

export function bindAuthStateListener(onChange) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    profileCache = null;
    onChange?.(session);
  });
}

export async function createManagedStaffLogin({ email, password, fullName }) {
  if (!email) {
    throw new Error("A staff email is required to create a login account.");
  }

  if (!password || password.length < 6) {
    throw new Error("Staff login password must be at least 6 characters.");
  }

  const signupClient = createTransientSupabaseClient(`tjs-staff-signup-${Date.now()}`);
  const { data, error } = await signupClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || email.split("@")[0],
        role: ROLES.STAFF,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase did not return the new staff account.");
  }

  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("A login account already exists for this email.");
  }

  await signupClient.auth.signOut();
  return data.user;
}
