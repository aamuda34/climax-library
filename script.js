import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = "https://tgerdrdangqrbffjxdbb.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZXJkcmRhbmdxcmJmZmp4ZGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDgxNjUsImV4cCI6MjEwNDMyNDE2NX0.DjWbXXei1lzSDilHc06BS8Yd02jgZqkVAPuhzOCTP1w"
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function fetchBooks(classLevel) {
  const { data, error } = await supabase
    .from('books')
    .select('category, cover_url, pdf_url, class_level')
    .eq('class_level', classLevel)

  if (error) {
    return [{ category: "Error fetching books", cover_url: "", pdf_url: "", class_level: "" }]
  }
  if (!data || data.length === 0) {
    return [{ category: "No books found for " + classLevel, cover_url: "", pdf_url: "", class_level: classLevel }]
  }
  return data
}

async function loadBooks() {
  const level = document.getElementById("classLevel").value
  const books = await fetchBooks(level)
  const container = document.getElementById("books")
  container.innerHTML = ""
  books.forEach(book => {
    const div = document.createElement("div")
    div.innerHTML = `
      <h3>${book.category}</h3>
      ${book.cover_url ? `<img src="${book.cover_url}" alt="${book.category}" width="120"/>` : ""}
      ${book.pdf_url ? `<p><a href="${book.pdf_url}" target="_blank">Read PDF</a></p>` : ""}
      <p>Class Level: ${book.class_level}</p>
    `
    container.appendChild(div)
  })
}

// Expose globally
window.loadBooks = loadBooks
