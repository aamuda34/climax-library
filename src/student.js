import { supabase } from './supabase.js';
import { getMyProfile, signOut } from './auth.js';
import { openBookReader, downloadBookFile } from './bookReader.js';

const LEVELS = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3'];

let currentProfile = null;
let books = [];

const app = document.querySelector('#app');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function levelLabel(level) {
  return level || 'Not assigned';
}

function statusScreen(title, message, type = '') {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="status-card ${type}">
        <img class="brand-logo" src="/climax-logo.png" alt="CLIMAX Library Foundation">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <button id="logoutBtn" class="primary-btn">Sign out</button>
      </section>
    </main>
  `;

  document.querySelector('#logoutBtn').addEventListener('click', signOut);
}



async function loadBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('published', true)
    .order('title');
  if (error) {
    console.error(error);
    books = [];
    return;
  }
  books = data || [];
}

function renderBooks(filter = '') {
  const grid = document.querySelector('#booksGrid');
  if (!grid) return;
  const term = filter.trim().toLowerCase();
  const filtered = books.filter(book =>
    !term ||
    (book.title || '').toLowerCase().includes(term) ||
    (book.author || '').toLowerCase().includes(term)
  );
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-card"><h3>No books found</h3><p>No books are currently available in the library.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(book => {
    const cover = book.cover_path ? supabase.storage.from('covers').getPublicUrl(book.cover_path).data.publicUrl : '';
    const typeLabel = String(book.file_type || 'pdf').toUpperCase();
    return `
      <article class="book-card">
        <div class="book-cover">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<span>${escapeHtml(typeLabel)}</span>`}</div>
        <div class="book-info">
          <div class="book-type">${escapeHtml(typeLabel)} · ${book.allow_download ? 'Download available' : 'Online reading'}</div>
          <h3>${escapeHtml(book.title)}</h3>
          <p>${escapeHtml(book.author || 'Unknown author')}</p>
          <div class="book-actions">
            <button class="read-btn" data-id="${book.id}">Read book</button>
            ${book.allow_download ? `<button class="download-btn" data-id="${book.id}" type="button">Download</button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
  grid.querySelectorAll('.read-btn').forEach(button => button.addEventListener('click', () => openBook(button.dataset.id)));
  grid.querySelectorAll('.download-btn').forEach(button => button.addEventListener('click', () => downloadStudentBook(button.dataset.id, button)));
}

async function downloadStudentBook(bookId, button) {
  const book = books.find(item => String(item.id) === String(bookId));
  if (!book || !book.allow_download) return;
  const original = button.textContent;
  button.disabled = true; button.textContent = 'Preparing…';
  try { await downloadBookFile(supabase, book); }
  catch (error) { console.error(error); alert('The book could not be downloaded right now.'); }
  finally { button.disabled = false; button.textContent = original; }
}

async function openBook(bookId) {
  const book = books.find(item => String(item.id) === String(bookId));
  if (!book) return;
  try { await openBookReader(supabase, book); }
  catch (error) { console.error(error); alert('The book could not be opened right now.'); }
}

function renderDashboard() {
  app.innerHTML = `
    <div class="student-layout">
      <header class="topbar">
        <div class="brand">
          <img class="brand-logo" src="/climax-logo.png" alt="CLIMAX Library Foundation">
          <div>
            <strong>CLIMAX Library</strong>
            <span>Student Library</span>
          </div>
        </div>

        <button id="logoutBtn" class="secondary-btn">Sign out</button>
      </header>

      <main class="student-main">
        <section class="welcome-card">
          <div>
            <span class="eyebrow">WELCOME</span>
            <h1>Hello, ${escapeHtml(currentProfile.full_name)}</h1>
            <p>Your approved library access is ready. Every published book is available to you.</p>
          </div>

          <div class="student-badge">
            <strong>${escapeHtml(levelLabel(currentProfile.level))}</strong>
            ${
              currentProfile.department
                ? `<span>${escapeHtml(currentProfile.department)}</span>`
                : ''
            }
          </div>
        </section>

        <section class="library-section">
          <div class="section-heading">
            <div>
              <span class="eyebrow">CLIMAX LIBRARY</span>
              <h2>Available books</h2>
            </div>

            <input
              id="searchBooks"
              type="search"
              placeholder="Search books..."
              aria-label="Search books"
            >
          </div>

          <div id="booksGrid" class="books-grid"></div>
        </section>
      </main>
    </div>
  `;

  document.querySelector('#logoutBtn')
    .addEventListener('click', signOut);

  document.querySelector('#searchBooks')
    .addEventListener('input', event => {
      renderBooks(event.target.value);
    });

  renderBooks();
}

async function init() {
  const { user, profile, error } = await getMyProfile();

  if (!user) {
    window.location.href = '/';
    return;
  }

  if (error || !profile) {
    statusScreen(
      'Profile unavailable',
      'Your account exists, but your library profile could not be loaded.'
    );
    return;
  }

  if (profile.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }

  currentProfile = profile;

  if (profile.status === 'pending') {
    statusScreen(
      'Account pending',
      'Your registration has been received. An administrator must approve your account before you can access the library.',
      'pending'
    );
    return;
  }

  if (profile.status === 'rejected') {
    statusScreen(
      'Registration rejected',
      'Your registration was not approved. Please contact the library administrator if you believe this was a mistake.',
      'rejected'
    );
    return;
  }

  if (profile.status === 'suspended') {
    statusScreen(
      'Account suspended',
      'Your library account is currently suspended. Please contact the administrator.',
      'suspended'
    );
    return;
  }

  if (profile.status !== 'active') {
    statusScreen(
      'Access unavailable',
      'Your account is not currently active.'
    );
    return;
  }


  await loadBooks();
  renderDashboard();
}

init();
