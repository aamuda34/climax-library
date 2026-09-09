
import { supabase } from './supabase.js';

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user || null;
}

export async function getMyProfile() {
  const user = await getCurrentUser();
  if (!user) return { user: null, profile: null, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile: data, error };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

export async function requireStudent() {
  const result = await getMyProfile();

  if (!result.user) {
    window.location.href = '/';
    return null;
  }

  if (!result.profile) {
    alert('Your account profile could not be found.');
    await signOut();
    return null;
  }

  if (result.profile.role === 'admin') {
    window.location.href = '/admin.html';
    return null;
  }

  return result;
}

export async function requireAdmin() {
  const result = await getMyProfile();

  if (!result.user) {
    window.location.href = '/';
    return null;
  }

  if (
    !result.profile ||
    result.profile.role !== 'admin' ||
    result.profile.status !== 'active'
  ) {
    alert('Administrator access is required.');
    window.location.href = '/';
    return null;
  }

  return result;
}
