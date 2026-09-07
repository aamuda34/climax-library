import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = "https://tgerdrdangqrbffjxdbb.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function fetchBooks(classLevel) {
  console.log("Fetching books for:", classLevel)  // DEBUG
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('class_level', classLevel)

  if (error) {
    console.error("Error fetching books:", error)
    return []
  }
  console.log("Books returned:", data)  // DEBUG
  return data
}

async function loadBooks() {
  const level = document.getElementById("classLevel").value
  const books = await fetchBooks(level)
  const container = document.getElementById("books")
  container.innerHTML = ""
  if (books.length === 0) {
    container.innerHTML = "<p>No books found for " + level + "</p>"
  }
  books.forEach(book => {
    const div = document.createElement("div")
    div.innerHTML = `
      <h3>${book.title}</h3>
      <img src="${book.cover_url}" alt="${book.title}" width="120"/>
      <p><a href="${book.pdf_url}" target="_blank">Read PDF</a></p>
    `
    container.appendChild(div)
  })
}
