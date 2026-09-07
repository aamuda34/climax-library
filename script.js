// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Replace with your Supabase project details
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY"

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Fetch books by class level
async function fetchBooks(classLevel) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('class_level', classLevel)

  if (error) {
    console.error("Error fetching books:", error)
    return []
  }
  return data
}

// Load books when dropdown changes
async function loadBooks() {
  const level = document.getElementById("classLevel").value
  const books = await fetchBooks(level)
  const container = document.getElementById("books")
  container.innerHTML = ""
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
