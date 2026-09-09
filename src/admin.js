
import { supabase } from './supabase.js';
import { requireAdmin, signOut } from './auth.js';

const app = document.querySelector('#app');

let students = [];
let books = [];

const levels = ['JSS1','JSS2','JSS3','SSS1','SSS2','SSS3'];
const departments = ['Science','Commercial','Arts'];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSss(level) {
  return level?.startsWith('SSS');
}

async function loadData() {
  const [studentsResult, booksResult] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('books').select('*').order('created_at', { ascending: false })
  ]);

  if (studentsResult.error) console.error(studentsResult.error);
  if (booksResult.error) console.error(booksResult.error);

  students = studentsResult.data || [];
  books = booksResult.data || [];
}

function render() {
  const pending = students.filter(s => s.status === 'pending').length;
  const active = students.filter(s => s.status === 'active' && s.role === 'student').length;

  app.innerHTML = `
    <div class="admin-layout">
      <aside class="sidebar">
        <div class="brand sidebar-brand">
          <div class="brand-mark">C</div>
          <div>
            <strong>CLIMAX Library</strong>
            <span>Administration</span>
          </div>
        </div>

        <nav>
          <button class="nav-btn active" data-section="overview">Overview</button>
          <button class="nav-btn" data-section="students">Students</button>
          <button class="nav-btn" data-section="books">Books</button>
        </nav>

        <button id="logoutBtn" class="secondary-btn sidebar-logout">Sign out</button>
      </aside>

      <main class="admin-main">
        <header class="admin-header">
          <div>
            <span class="eyebrow">ADMINISTRATION</span>
            <h1>Library Management</h1>
          </div>
          <div class="admin-name">Adeyimika Emmanuel Amuda</div>
        </header>

        <section id="adminContent"></section>
      </main>
    </div>
  `;

  document.querySelector('#logoutBtn').addEventListener('click', signOut);

  document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      renderSection(button.dataset.section);
    });
  });

  renderSection('overview');
}

function renderSection(section) {
  const content = document.querySelector('#adminContent');

  if (section === 'overview') {
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <span>Pending students</span>
          <strong>${pendingCount()}</strong>
        </div>
        <div class="stat-card">
          <span>Active students</span>
          <strong>${activeCount()}</strong>
        </div>
        <div class="stat-card">
          <span>Total books</span>
          <strong>${books.length}</strong>
        </div>
      </div>

      <div class="panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">QUICK ACTIONS</span>
            <h2>Manage CLIMAX Library</h2>
          </div>
        </div>

        <div class="quick-actions">
          <button class="primary-btn" id="goStudents">
            Review students (${pendingCount()} pending)
          </button>
          <button class="secondary-btn" id="goBooks">
            Manage books
          </button>
        </div>
      </div>
    `;

    document.querySelector('#goStudents').addEventListener('click', () => {
      document.querySelector('[data-section="students"]').click();
    });

    document.querySelector('#goBooks').addEventListener('click', () => {
      document.querySelector('[data-section="books"]').click();
    });

    return;
  }

  if (section === 'students') renderStudents(content);
  if (section === 'books') renderBooks(content);
}

function pendingCount() {
  return students.filter(s => s.status === 'pending' && s.role === 'student').length;
}

function activeCount() {
  return students.filter(s => s.status === 'active' && s.role === 'student').length;
}

function renderStudents(content) {
  const studentRows = students
    .filter(s => s.role === 'student')
    .map(student => `
      <tr>
        <td>
          <strong>${escapeHtml(student.full_name)}</strong>
          <small>${escapeHtml(student.email || '')}</small>
        </td>
        <td>${escapeHtml(student.student_id || '—')}</td>
        <td>${escapeHtml(student.level || '—')}</td>
        <td>${escapeHtml(student.department || '—')}</td>
        <td><span class="status ${student.status}">${escapeHtml(student.status)}</span></td>
        <td>
          <div class="row-actions">
            ${
              student.status === 'pending'
                ? `
                  <button class="small-btn approve-btn" data-id="${student.id}">Approve</button>
                  <button class="small-btn danger reject-btn" data-id="${student.id}">Reject</button>
                `
                : ''
            }
            ${
              student.status === 'active'
                ? `<button class="small-btn danger suspend-btn" data-id="${student.id}">Suspend</button>`
                : ''
            }
            ${
              student.status === 'suspended' || student.status === 'rejected'
                ? `<button class="small-btn activate-btn" data-id="${student.id}">Activate</button>`
                : ''
            }
            <button class="small-btn edit-student-btn" data-id="${student.id}">Edit</button>
          </div>
        </td>
      </tr>
    `).join('');

  content.innerHTML = `
    <div class="panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">STUDENT ACCOUNTS</span>
          <h2>Students</h2>
        </div>
        <input id="studentSearch" type="search" placeholder="Search students...">
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Student ID</th>
              <th>Level</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="studentRows">${studentRows}</tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelector('#studentSearch').addEventListener('input', event => {
    const term = event.target.value.toLowerCase();
    document.querySelector('#studentRows').innerHTML = students
      .filter(s => s.role === 'student')
      .filter(s =>
        !term ||
        s.full_name.toLowerCase().includes(term) ||
        (s.email || '').toLowerCase().includes(term) ||
        (s.student_id || '').toLowerCase().includes(term)
      )
      .map(studentRow)
      .join('');

    bindStudentButtons();
  });

  bindStudentButtons();
}

function studentRow(student) {
  return `
    <tr>
      <td>
        <strong>${escapeHtml(student.full_name)}</strong>
        <small>${escapeHtml(student.email || '')}</small>
      </td>
      <td>${escapeHtml(student.student_id || '—')}</td>
      <td>${escapeHtml(student.level || '—')}</td>
      <td>${escapeHtml(student.department || '—')}</td>
      <td><span class="status ${student.status}">${escapeHtml(student.status)}</span></td>
      <td>
        <div class="row-actions">
          ${
            student.status === 'pending'
              ? `
                <button class="small-btn approve-btn" data-id="${student.id}">Approve</button>
                <button class="small-btn danger reject-btn" data-id="${student.id}">Reject</button>
              `
              : ''
          }
          ${
            student.status === 'active'
              ? `<button class="small-btn danger suspend-btn" data-id="${student.id}">Suspend</button>`
              : ''
          }
          ${
            student.status === 'suspended' || student.status === 'rejected'
              ? `<button class="small-btn activate-btn" data-id="${student.id}">Activate</button>`
              : ''
          }
          <button class="small-btn edit-student-btn" data-id="${student.id}">Edit</button>
        </div>
      </td>
    </tr>
  `;
}

function bindStudentButtons() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.onclick = () => updateStudentStatus(btn.dataset.id, 'active');
  });

  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.onclick = () => updateStudentStatus(btn.dataset.id, 'rejected');
  });

  document.querySelectorAll('.suspend-btn').forEach(btn => {
    btn.onclick = () => updateStudentStatus(btn.dataset.id, 'suspended');
  });

  document.querySelectorAll('.activate-btn').forEach(btn => {
    btn.onclick = () => updateStudentStatus(btn.dataset.id, 'active');
  });

  document.querySelectorAll('.edit-student-btn').forEach(btn => {
    btn.onclick = () => editStudent(btn.dataset.id);
  });
}

async function updateStudentStatus(id, status) {
  const student = students.find(
    s => String(s.id) === String(id)
  );

  if (!student) return;

  const actionLabels = {
    active:
      student.status === 'pending'
        ? 'approve'
        : 'activate',
    rejected: 'reject',
    suspended: 'suspend'
  };

  const action = actionLabels[status] || 'update';

  const confirmed = confirm(
    `${action.charAt(0).toUpperCase() + action.slice(1)} ` +
    `${student.full_name}?\n\n` +
    `Current status: ${student.status}\n` +
    `New status: ${status}`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', id);

  if (error) {
    alert('Could not update the student.');
    console.error(error);
    return;
  }

  await loadData();
  renderSection('students');
}

async function editStudent(id) {
  const student = students.find(s => String(s.id) === String(id));
  if (!student) return;

  const currentLevel = student.level || '';
  const currentDepartment = student.department || '';

  const levelOptions = levels.map(level =>
    `<option value="${level}" ${level === currentLevel ? 'selected' : ''}>${level}</option>`
  ).join('');

  const departmentOptions = departments.map(department =>
    `<option value="${department}" ${department === currentDepartment ? 'selected' : ''}>${department}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="admin-modal-backdrop"></div>
    <div class="admin-modal-card">
      <div class="admin-modal-header">
        <div>
          <h3>Edit Student</h3>
          <p>${escapeHtml(student.full_name || '')}</p>
        </div>
        <button type="button" class="admin-modal-close" id="closeStudentEdit">×</button>
      </div>

      <form id="studentEditForm">
        <label>
          Level
          <select name="level" id="editStudentLevel" required>
            ${levelOptions}
          </select>
        </label>

        <label id="editDepartmentWrap" style="display:${currentLevel.startsWith('SSS') ? 'block' : 'none'}">
          Department
          <select name="department" id="editStudentDepartment">
            <option value="">Select department</option>
            ${departmentOptions}
          </select>
        </label>

        <div class="admin-modal-actions">
          <button type="button" class="secondary-btn" id="cancelStudentEdit">Cancel</button>
          <button type="submit" class="primary-btn">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const levelSelect = modal.querySelector('#editStudentLevel');
  const departmentWrap = modal.querySelector('#editDepartmentWrap');
  const departmentSelect = modal.querySelector('#editStudentDepartment');

  function updateDepartmentVisibility() {
    const isSSS = levelSelect.value.startsWith('SSS');
    departmentWrap.style.display = isSSS ? 'block' : 'none';
    departmentSelect.required = isSSS;

    if (!isSSS) {
      departmentSelect.value = '';
    }
  }

  levelSelect.addEventListener('change', updateDepartmentVisibility);

  function closeModal() {
    modal.remove();
  }

  modal.querySelector('#closeStudentEdit').addEventListener('click', closeModal);
  modal.querySelector('#cancelStudentEdit').addEventListener('click', closeModal);
  modal.querySelector('.admin-modal-backdrop').addEventListener('click', closeModal);

  modal.querySelector('#studentEditForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const level = levelSelect.value;
    const department = level.startsWith('SSS') ? departmentSelect.value : null;

    if (!level) {
      alert('Please select a level.');
      return;
    }

    if (level.startsWith('SSS') && !department) {
      alert('Please select a department for SSS students.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        level,
        department
      })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Could not update the student.');
      return;
    }

    closeModal();
    await loadData();
    renderSection('students');
  });
}

function renderBooks(content) {
  const rows = books.map(book => `
    <tr>
      <td><strong>${escapeHtml(book.title)}</strong></td>
      <td>${escapeHtml(book.author || '—')}</td>
      <td>${escapeHtml(book.level)}</td>
      <td>${escapeHtml(book.department || '—')}</td>
      <td>${book.published ? 'Published' : 'Hidden'}</td>
      <td>
        <button class="small-btn toggle-book-btn" data-id="${book.id}">
          ${book.published ? 'Hide' : 'Publish'}
        </button>
        <button class="small-btn danger delete-book-btn" data-id="${book.id}">
          Delete
        </button>
      </td>
    </tr>
  `).join('');

  content.innerHTML = `
    <div class="panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">LIBRARY CONTENT</span>
          <h2>Books</h2>
        </div>
        <button id="addBookBtn" class="primary-btn">Add book</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Level</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6">No books yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelector('#addBookBtn').addEventListener('click', showBookForm);

  document.querySelectorAll('.toggle-book-btn').forEach(btn => {
    btn.onclick = () => toggleBook(btn.dataset.id);
  });

  document.querySelectorAll('.delete-book-btn').forEach(btn => {
    btn.onclick = () => deleteBook(btn.dataset.id);
  });
}

async function toggleBook(id) {
  const book = books.find(b => String(b.id) === String(id));
  if (!book) return;

  const { error } = await supabase
    .from('books')
    .update({ published: !book.published })
    .eq('id', id);

  if (error) {
    alert('Could not change book status.');
    return;
  }

  await loadData();
  renderSection('books');
}

async function deleteBook(id) {
  const book = books.find(b => String(b.id) === String(id));
  if (!book) return;

  if (!confirm(
    `Delete "${book.title}"?\n\n` +
    `This will permanently remove the book record, ` +
    `book file, and cover image.`
  )) {
    return;
  }

  const filePath = String(book.file_path || '').trim();
  const coverPath = String(book.cover_path || '').trim();

  /*
   * Remove the private book file first.
   * The PDF/EPUB bucket is intentionally private.
   */
  if (filePath) {
    const { error: fileError } = await supabase
      .storage
      .from('pdf')
      .remove([filePath]);

    if (fileError) {
      alert(
        'Could not remove the book file from storage. ' +
        'The book was not deleted.'
      );
      console.error('Book file deletion error:', fileError);
      return;
    }
  }

  /*
   * Remove the optional public cover image.
   */
  if (coverPath) {
    const { error: coverError } = await supabase
      .storage
      .from('covers')
      .remove([coverPath]);

    if (coverError) {
      alert(
        'The book file was removed, but the cover image ' +
        'could not be removed. The database record was not deleted.'
      );
      console.error('Cover deletion error:', coverError);
      return;
    }
  }

  /*
   * Only remove the database record after Storage cleanup succeeds.
   */
  const { error: databaseError } = await supabase
    .from('books')
    .delete()
    .eq('id', id);

  if (databaseError) {
    alert(
      'The storage files were removed, but the book record ' +
      'could not be deleted from the database.'
    );
    console.error('Book database deletion error:', databaseError);
    return;
  }

  alert('Book deleted successfully.');

  await loadData();
  renderSection('books');
}

function showBookForm() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2>Add book</h2>
        <button type="button" class="icon-btn" id="closeModal">×</button>
      </div>

      <form id="bookForm">
        <label>Book title
          <input name="title" required>
        </label>

        <label>Author
          <input name="author">
        </label>

        <label>Description
          <textarea name="description" rows="4"></textarea>
        </label>

        <label>Level
          <select name="level" id="bookLevel" required>
            <option value="">Choose level</option>
            ${levels.map(l => `<option value="${l}">${l}</option>`).join('')}
          </select>
        </label>

        <label id="departmentField" style="display:none">Department
          <select name="department">
            <option value="">Choose department</option>
            ${departments.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </label>

        <label>Cover image
          <input type="file" name="cover" accept="image/*">
        </label>

        <label>Book file (PDF or EPUB)
          <input
            type="file"
            name="book"
            accept="application/pdf,.pdf,application/epub+zip,.epub"
            required
          >
        </label>

        <button class="primary-btn" type="submit">Upload book</button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#closeModal').onclick = () => modal.remove();

  modal.querySelector('#bookLevel').addEventListener('change', event => {
    modal.querySelector('#departmentField').style.display =
      isSss(event.target.value) ? 'block' : 'none';
  });

  modal.querySelector('#bookForm').addEventListener('submit', async event => {
    event.preventDefault();

    const form = new FormData(event.target);

    const title = String(form.get('title') || '').trim();
    const author = String(form.get('author') || '').trim();
    const description = String(form.get('description') || '').trim();
    const level = String(form.get('level') || '').trim();
    const department = isSss(level) ? form.get('department') : null;
    const coverFile = form.get('cover');
    const bookFile = form.get('book');

    if (!title) {
      alert('Enter the book title.');
      return;
    }

    if (!level) {
      alert('Choose a level.');
      return;
    }

    if (isSss(level) && !department) {
      alert('Choose a department for SSS books.');
      return;
    }

    if (!bookFile || bookFile.size === 0) {
      alert('Select a PDF or EPUB book.');
      return;
    }

    const lowerName = bookFile.name.toLowerCase();

    let fileType;
    let extension;
    let contentType;

    if (
      lowerName.endsWith('.epub') ||
      bookFile.type === 'application/epub+zip'
    ) {
      fileType = 'epub';
      extension = 'epub';
      contentType = 'application/epub+zip';
    } else if (
      lowerName.endsWith('.pdf') ||
      bookFile.type === 'application/pdf'
    ) {
      fileType = 'pdf';
      extension = 'pdf';
      contentType = 'application/pdf';
    } else {
      alert('Only PDF and EPUB books are supported.');
      return;
    }

    const safeName = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const unique =
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const filePath =
      `${level}/${unique}-${safeName}.${extension}`;

    const bookUpload = await supabase.storage
      .from('pdf')
      .upload(filePath, bookFile, {
        contentType,
        upsert: false
      });

    if (bookUpload.error) {
      alert(`${fileType.toUpperCase()} upload failed.`);
      console.error(bookUpload.error);
      return;
    }

    let coverPath = null;

    if (coverFile && coverFile.size > 0) {
      const coverExtension =
        coverFile.name.split('.').pop() || 'jpg';

      coverPath =
        `${level}/${unique}-${safeName}.${coverExtension}`;

      const coverUpload = await supabase.storage
        .from('covers')
        .upload(coverPath, coverFile, {
          upsert: false
        });

      if (coverUpload.error) {
        await supabase.storage
          .from('pdf')
          .remove([filePath]);

        alert('Cover upload failed.');
        console.error(coverUpload.error);
        return;
      }
    }

    const { error } = await supabase
      .from('books')
      .insert({
        title,
        author,
        description,
        level,
        department,
        cover_path: coverPath,
        file_path: filePath,
        file_type: fileType,
        published: true
      });

    if (error) {
      await supabase.storage
        .from('pdf')
        .remove([filePath]);

      if (coverPath) {
        await supabase.storage
          .from('covers')
          .remove([coverPath]);
      }

      alert('Book record could not be created.');
      console.error(error);
      return;
    }

    alert(
      `Book uploaded successfully as ${fileType.toUpperCase()}.`
    );

    modal.remove();

    await loadData();
    renderSection('books');
  });
}

async function init() {
  const result = await requireAdmin();
  if (!result) return;

  await loadData();
  render();
}

init();
