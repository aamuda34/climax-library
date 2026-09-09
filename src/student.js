import { supabase } from './supabase.js';
import { getMyProfile, signOut } from './auth.js';
import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
        <div class="brand-mark">C</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <button id="logoutBtn" class="primary-btn">Sign out</button>
      </section>
    </main>
  `;

  document.querySelector('#logoutBtn').addEventListener('click', signOut);
}


/* CLIMAX_PDF_ZOOM */
const pdfZoomState = {
  scale: 1,
  startScale: 1,
  startDistance: 0,
  initialized: false
};

function setupPdfZoom(viewer) {
  if (!viewer || viewer.dataset.zoomReady === "true") return;

  viewer.dataset.zoomReady = "true";

  const state = {
    scale: 1,
    startScale: 1,
    startDistance: 0
  };

  const applyZoom = () => {
    state.scale = Math.max(1, Math.min(4, state.scale));
    viewer.style.transformOrigin = "top center";
    viewer.style.transform = `scale(${state.scale})`;
    viewer.style.width = state.scale === 1 ? "100%" : `${100 / state.scale}%`;
    viewer.style.marginLeft = state.scale === 1 ? "0" : `${(100 - 100 / state.scale) / 2}%`;
  };

  const distance = (a, b) => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  viewer.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      event.stopPropagation();
      state.startDistance = distance(event.touches[0], event.touches[1]);
      state.startScale = state.scale;
    }
  }, { passive: false });

  viewer.addEventListener("touchmove", (event) => {
    if (event.touches.length === 2 && state.startDistance > 0) {
      event.preventDefault();
      event.stopPropagation();

      const currentDistance = distance(event.touches[0], event.touches[1]);
      const ratio = currentDistance / state.startDistance;

      state.scale = state.startScale * ratio;
      applyZoom();
    }
  }, { passive: false });

  viewer.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) {
      state.startDistance = 0;
    }
  }, { passive: true });

  viewer.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;

    event.preventDefault();

    if (event.deltaY < 0) {
      state.scale += 0.15;
    } else {
      state.scale -= 0.15;
    }

    applyZoom();
  }, { passive: false });

  applyZoom();

  viewer._climaxZoomIn = () => {
    state.scale += 0.25;
    applyZoom();
  };

  viewer._climaxZoomOut = () => {
    state.scale -= 0.25;
    applyZoom();
  };

  viewer._climaxZoomReset = () => {
    state.scale = 1;
    applyZoom();
  };
}

function setupPdfZoomWatcher() {
  if (window.__climaxPdfZoomWatcher) return;

  window.__climaxPdfZoomWatcher = true;

  const observer = new MutationObserver(() => {
    const viewer = document.querySelector(".pdf-full-viewer");
    if (viewer) setupPdfZoom(viewer);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  const viewer = document.querySelector(".pdf-full-viewer");
  if (viewer) setupPdfZoom(viewer);
}

document.addEventListener("keydown", (event) => {
  const viewer = document.querySelector(".pdf-full-viewer");
  if (!viewer) return;

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    viewer._climaxZoomIn?.();
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    viewer._climaxZoomOut?.();
  } else if (event.key === "0") {
    event.preventDefault();
    viewer._climaxZoomReset?.();
  }
});

setupPdfZoomWatcher();

/* END CLIMAX_PDF_ZOOM */

async function loadBooks() {
  let query = supabase
    .from('books')
    .select('*')
    .eq('published', true)
    .eq('level', currentProfile.level)
    .order('title');

  if (currentProfile.level?.startsWith('SSS')) {
    query = query.eq('department', currentProfile.department);
  }

  const { data, error } = await query;

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
    grid.innerHTML = `
      <div class="empty-card">
        <h3>No books found</h3>
        <p>
          No books currently match your level${currentProfile.level?.startsWith('SSS') ? ' and department' : ''}.
        </p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(book => {
    const cover = book.cover_path
      ? supabase.storage
          .from('covers')
          .getPublicUrl(book.cover_path).data.publicUrl
      : '';

    const typeLabel =
      String(book.file_type || 'pdf').toUpperCase();

    return `
      <article class="book-card">
        <div class="book-cover">
          ${
            cover
              ? `<img src="${escapeHtml(cover)}" alt="">`
              : `<span>${escapeHtml(typeLabel)}</span>`
          }
        </div>

        <div class="book-info">
          <h3>${escapeHtml(book.title)}</h3>
          <p>${escapeHtml(book.author || 'Unknown author')}</p>
          <button class="read-btn" data-id="${book.id}">
            Read book
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.read-btn').forEach(button => {
    button.addEventListener('click', () => {
      openBook(button.dataset.id);
    });
  });
}

async function createBookSignedUrl(book) {
  if (!book.file_path) {
    throw new Error('This book does not have a file path.');
  }

  const { data, error } = await supabase.storage
    .from('pdf')
    .createSignedUrl(book.file_path, 60 * 10);

  if (error || !data?.signedUrl) {
    throw error || new Error('Could not create a secure book URL.');
  }

  return data.signedUrl;
}

function closeReader(modal, rendition = null) {
  if (rendition) {
    try {
      rendition.destroy();
    } catch (error) {
      console.warn('Could not destroy EPUB reader:', error);
    }
  }

  modal.remove();
}

function createReaderShell(book, type) {
  const reader = document.createElement('div');

  reader.className = 'full-reader';

  reader.innerHTML = `
    <header class="full-reader-header">
      <div class="full-reader-title">
        <strong>${escapeHtml(book.title)}</strong>
        <small>${type} · Online reader</small>
      </div>

      <button
        class="full-reader-close"
        type="button"
        aria-label="Close reader"
      >×</button>
    </header>

    <main class="full-reader-content"></main>

    <footer class="full-reader-controls"></footer>
  `;

  document.body.appendChild(reader);

  return reader;
}

async function openPdfReader(book, signedUrl) {
  const reader = createReaderShell(book, 'PDF');

  const content = reader.querySelector('.full-reader-content');
  const controls = reader.querySelector('.full-reader-controls');
  const closeButton = reader.querySelector('.full-reader-close');

  content.innerHTML = `
    <div class="pdf-full-viewer">
      <div class="reader-loading">Opening book…</div>
    </div>
  `;

  controls.innerHTML = `
    <button id="pdfPrev" class="reader-control" type="button">
      Previous
    </button>

    <span id="pdfLocation">Loading…</span>

    <button id="pdfNext" class="reader-control" type="button">
      Next
    </button>
  `;

  const viewer = content.querySelector('.pdf-full-viewer');
  const locationLabel = reader.querySelector('#pdfLocation');
  const previousButton = reader.querySelector('#pdfPrev');
  const nextButton = reader.querySelector('#pdfNext');

  let pdfDocument = null;
  let currentPage = 1;
  let rendering = false;
  let queuedPage = null;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  const closeReader = () => {
    reader.remove();
    document.body.style.overflow = '';
  };

  closeButton.addEventListener('click', closeReader);

  document.body.style.overflow = 'hidden';

  const renderPage = async pageNumber => {
    if (!pdfDocument) return;

    const targetPage = Math.max(
      1,
      Math.min(pageNumber, pdfDocument.numPages)
    );

    if (rendering) {
      queuedPage = targetPage;
      return;
    }

    rendering = true;

    try {
      const page = await pdfDocument.getPage(targetPage);

      const rect = viewer.getBoundingClientRect();

      const availableWidth = Math.max(
        rect.width - 24,
        280
      );

      const availableHeight = Math.max(
        rect.height - 24,
        300
      );

      const baseViewport = page.getViewport({
        scale: 1
      });

      const widthScale =
        availableWidth / baseViewport.width;

      const heightScale =
        availableHeight / baseViewport.height;

      const scale = Math.max(
        0.1,
        Math.min(widthScale, heightScale)
      );

      const viewport = page.getViewport({
        scale
      });

      viewer.innerHTML = '';

      const pageWrap = document.createElement('div');
      pageWrap.className = 'full-pdf-page-wrap';

      const canvas = document.createElement('canvas');
      canvas.className = 'full-pdf-page';

      const deviceScale = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.ceil(
        viewport.width * deviceScale
      );

      canvas.height = Math.ceil(
        viewport.height * deviceScale
      );

      canvas.style.width =
        `${Math.ceil(viewport.width)}px`;

      canvas.style.height =
        `${Math.ceil(viewport.height)}px`;

      pageWrap.appendChild(canvas);
      viewer.appendChild(pageWrap);

      const context = canvas.getContext('2d', {
        alpha: false
      });

      await page.render({
        canvasContext: context,
        viewport,
        transform:
          deviceScale !== 1
            ? [
                deviceScale,
                0,
                0,
                deviceScale,
                0,
                0
              ]
            : null
      }).promise;

      currentPage = targetPage;

      locationLabel.textContent =
        `Page ${currentPage} of ${pdfDocument.numPages}`;

      previousButton.disabled =
        currentPage <= 1;

      nextButton.disabled =
        currentPage >= pdfDocument.numPages;

    } catch (error) {
      console.error(
        'PDF page render failed:',
        error
      );

      viewer.innerHTML = `
        <div class="reader-loading">
          <div>
            <strong>
              Unable to display this page.
            </strong>
            <p>Please try again.</p>
          </div>
        </div>
      `;
    } finally {
      rendering = false;

      if (queuedPage !== null) {
        const nextPage = queuedPage;
        queuedPage = null;
        renderPage(nextPage);
      }
    }
  };

  const goToPage = pageNumber => {
    if (!pdfDocument) return;

    renderPage(
      Math.max(
        1,
        Math.min(
          pageNumber,
          pdfDocument.numPages
        )
      )
    );
  };

  previousButton.addEventListener(
    'click',
    () => goToPage(currentPage - 1)
  );

  nextButton.addEventListener(
    'click',
    () => goToPage(currentPage + 1)
  );

  /*
   * Mobile book navigation.
   * Swipe left  = next page.
   * Swipe right = previous page.
   */
  viewer.addEventListener(
    'touchstart',
    event => {
      if (!event.touches.length) return;

      const touch = event.touches[0];

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    },
    { passive: true }
  );

  viewer.addEventListener(
    'touchend',
    event => {
      if (!event.changedTouches.length) return;

      const touch =
        event.changedTouches[0];

      const deltaX =
        touch.clientX - touchStartX;

      const deltaY =
        touch.clientY - touchStartY;

      const duration =
        Date.now() - touchStartTime;

      const horizontalDistance =
        Math.abs(deltaX);

      const verticalDistance =
        Math.abs(deltaY);

      if (
        duration <= 700 &&
        horizontalDistance >= 60 &&
        horizontalDistance >
          verticalDistance * 1.25
      ) {
        if (deltaX < 0) {
          goToPage(currentPage + 1);
        } else {
          goToPage(currentPage - 1);
        }
      }
    },
    { passive: true }
  );

  reader.addEventListener(
    'keydown',
    event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPage(currentPage - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToPage(currentPage + 1);
      }

      if (event.key === 'Escape') {
        closeReader();
      }
    }
  );

  reader.tabIndex = 0;
  reader.focus();

  const resizeHandler = () => {
    if (pdfDocument && !rendering) {
      renderPage(currentPage);
    }
  };

  window.addEventListener(
    'resize',
    resizeHandler
  );

  const originalRemove = reader.remove.bind(reader);

  reader.remove = () => {
    window.removeEventListener(
      'resize',
      resizeHandler
    );

    document.body.style.overflow = '';

    originalRemove();
  };

  try {
    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to load PDF (${response.status})`
      );
    }

    const buffer =
      await response.arrayBuffer();

    if (!buffer.byteLength) {
      throw new Error(
        'The PDF file is empty.'
      );
    }

    pdfDocument =
      await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
      }).promise;

    await renderPage(1);

  } catch (error) {
    console.error(
      'PDF reader failed:',
      error
    );

    viewer.innerHTML = `
      <div class="reader-loading">
        <div>
          <strong>
            Unable to open this PDF.
          </strong>
          <p>
            The book could not be displayed right now.
          </p>
        </div>
      </div>
    `;
  }
}

async function openEpubReader(book, signedUrl) {
  const reader = createReaderShell(book, 'EPUB');

  const content = reader.querySelector('.full-reader-content');
  const controls = reader.querySelector('.full-reader-controls');
  const closeButton = reader.querySelector('.full-reader-close');

  content.innerHTML = `
    <div id="epubViewer" style="
      width:100%;
      height:100%;
      min-height:0;
      overflow:hidden;
      background:#fff;
    ">
      <div class="reader-loading">
        Opening book…
      </div>
    </div>
  `;

  controls.innerHTML = `
    <button id="epubPrev" class="reader-control" type="button">
      Previous
    </button>
    <span id="epubLocation" class="reader-location">
      Loading…
    </span>
    <button id="epubNext" class="reader-control" type="button">
      Next
    </button>
  `;

  const viewer = reader.querySelector('#epubViewer');
  const locationLabel = reader.querySelector('#epubLocation');

  let rendition = null;
  let bookInstance = null;

  document.body.style.overflow = 'hidden';

  const closeReader = () => {
    closeReaderShell(reader, rendition);
  };

  closeButton.addEventListener('click', closeReader);

  try {
    locationLabel.textContent = '1/5 Preparing book…';

    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to open EPUB (${response.status})`
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    locationLabel.textContent = '2/5 Loading EPUB…';

    /*
     * EPUB.js 0.3.93 is more reliable when the Book instance
     * is created first and then opened with the ArrayBuffer.
     */
    bookInstance = ePub();

    locationLabel.textContent = '3/5 Reading EPUB structure…';

    await bookInstance.open(arrayBuffer);

    locationLabel.textContent = '4/5 Preparing book pages…';

    rendition = bookInstance.renderTo(viewer, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'paginated',
      manager: 'default'
    });

    rendition.on('relocated', (location) => {
      try {
        const current =
          location &&
          location.start &&
          location.start.display &&
          location.start.display.page;

        const total =
          location &&
          location.start &&
          location.start.display &&
          location.start.display.total;

        if (current && total) {
          locationLabel.textContent =
            `Page ${current} of ${total}`;
        } else {
          locationLabel.textContent = 'Reading';
        }
      } catch {
        locationLabel.textContent = 'Reading';
      }
    });

    await rendition.display();

    locationLabel.textContent = 'Page 1';

    const previousButton =
      reader.querySelector('#epubPrev');

    const nextButton =
      reader.querySelector('#epubNext');

    previousButton.addEventListener('click', () => {
      if (rendition) {
        rendition.prev();
      }
    });

    nextButton.addEventListener('click', () => {
      if (rendition) {
        rendition.next();
      }
    });

    let touchStartX = 0;

    viewer.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length === 1) {
          touchStartX = event.touches[0].clientX;
        }
      },
      { passive: true }
    );

    viewer.addEventListener(
      'touchend',
      (event) => {
        if (
          !touchStartX ||
          event.changedTouches.length !== 1
        ) {
          return;
        }

        const touchEndX =
          event.changedTouches[0].clientX;

        const distance =
          touchEndX - touchStartX;

        if (Math.abs(distance) >= 50) {
          if (distance < 0) {
            rendition.next();
          } else {
            rendition.prev();
          }
        }

        touchStartX = 0;
      },
      { passive: true }
    );

  } catch (error) {
    console.error('EPUB reader error:', error);

    locationLabel.textContent = 'Unable to open book';

    viewer.innerHTML = `
      <div class="reader-error">
        <h3>Unable to open this EPUB</h3>
        <p>
          The book was found, but the online reader could not
          render its pages.
        </p>
        <p class="reader-error-detail">
          ${escapeHtml(error?.message || 'Unknown EPUB error')}
        </p>
      </div>
    `;
  }
}

function closeReaderShell(
  reader,
  rendition = null
) {
  if (rendition) {
    try {
      rendition.destroy();
    } catch (error) {
      console.warn(
        'Could not destroy EPUB reader:',
        error
      );
    }
  }

  document.body.style.overflow = '';

  reader.remove();
}

async function openBook(bookId) {
  const book = books.find(item =>
    String(item.id) === String(bookId)
  );

  if (!book) return;

  try {
    const signedUrl = await createBookSignedUrl(book);

    const fileType =
      String(book.file_type || 'pdf').toLowerCase();

    if (fileType === 'epub') {
      await openEpubReader(book, signedUrl);
      return;
    }

    await openPdfReader(book, signedUrl);
  } catch (error) {
    alert('The book could not be opened right now.');
    console.error(error);
  }
}

function renderDashboard() {
  app.innerHTML = `
    <div class="student-layout">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">C</div>
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
            <p>Your approved library access is ready.</p>
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
              <span class="eyebrow">YOUR LIBRARY</span>
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

  if (!LEVELS.includes(profile.level)) {
    statusScreen(
      'Level not assigned',
      'Your account has been approved, but a library level has not been assigned yet.'
    );
    return;
  }

  await loadBooks();
  renderDashboard();
}

init();
